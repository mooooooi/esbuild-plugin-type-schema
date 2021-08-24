import {
    Plugin,
    PluginBuild,
    build as esbuild,
    BuildResult,
    BuildOptions,
} from "esbuild";
import { ForStatement, Project } from "ts-morph";
import {
    ClassTypeInfo,
    MethodTypeInfo,
    PropTypeInfo,
} from "./type-info";


interface TypeSchemaOption {
    onStart?(o: BuildOptions): void;
    onProgress(o: BuildOptions, classTypeInfo: ClassTypeInfo): void;
    onEnd?(o: BuildOptions, result: BuildResult): void;
    decFileFilter?: RegExp;
}

export function TypeSchema(option: TypeSchemaOption): Plugin {
    return {
        name: "TypeSchema",
        async setup(build: PluginBuild) {
            const handingFiles = new Set<string>();
            const decFiles = new Set<string>();
            if (option) {
                option.onStart &&
                    build.onStart(() => option.onStart(build.initialOptions));
                option.onEnd &&
                    build.onEnd((result) =>
                        option.onEnd(build.initialOptions, result)
                    );
            }

            const project = new Project();
            const decNames = new Set<string>();
            await getDecFiles(build, handingFiles, decFiles, option.decFileFilter);

            const decSourceFiles = project.addSourceFilesAtPaths(
                Array.from(decFiles.values())
            );

            for (let sf of decSourceFiles) {
                [...sf.getVariableDeclarations(), ...sf.getFunctions()].forEach(
                    (clr) => {
                        if (
                            !(
                                clr.isExported ||
                                clr.isNamedExport ||
                                clr.isDefaultExport
                            )
                        )
                            return;

                        decNames.add(clr.getName()!);
                    }
                );
            }

            console.log(decNames);

            build.onLoad({ filter: /.+\.ts/ }, (args) => {
                const sf = project.addSourceFileAtPath(args.path);

                var classes = sf.getClasses();
                for (const cls of classes) {
                    const decor = cls
                        .getDecorators()
                        .find((decor) => decNames.has(decor.getName()));
                    if (!decor) continue;

                    const props = cls.getProperties();
                    const propInfoArr: PropTypeInfo[] = [];
                    for (const prop of props) {
                        const propDecor = prop
                            .getDecorators()
                            .find((propDecor) =>
                                decNames.has(propDecor.getName())
                            );
                        if (!propDecor) continue;
                        propInfoArr.push({
                            decor: propDecor,
                            target: prop,
                        });
                    }

                    const methods = cls.getMethods();
                    const methodInfoArr: MethodTypeInfo[] = [];
                    for (const method of methods) {
                        const methodDecor = method
                            .getDecorators()
                            .find((methodDecor) =>
                                decNames.has(methodDecor.getName())
                            );
                        if (!methodDecor) continue;

                        methodInfoArr.push({
                            decor: methodDecor,
                            target: method,
                            params: method.getParameters().map((param) => {
                                const paramDecor = param
                                    .getDecorators()
                                    .find((paramDecor) =>
                                        decNames.has(paramDecor.getName())
                                    );
                                return {
                                    target: param,
                                    decor: paramDecor,
                                };
                            }),
                        });
                    }

                    const classTypeInfo: ClassTypeInfo = {
                        decor,
                        target: cls,
                        properties: propInfoArr,
                        methods: methodInfoArr,
                    };

                    option.onProgress(build.initialOptions, classTypeInfo);
                    decor.remove();
                    propInfoArr.forEach((info) => {
                        info.decor.remove();
                    });
                    methodInfoArr.forEach((info) => {
                        info.decor.remove();
                        info.params.forEach((param) => param.decor?.remove());
                    });
                }
                return {
                    contents: sf.getFullText(),
                    loader: "ts",
                };
            });
        },
    };
}

async function getDecFiles(
    build: PluginBuild,
    handingFiles: Set<string>,
    decFiles: Set<string>,
    decFilter: RegExp = /\.dec/
) {
    await esbuild({
        entryPoints: build.initialOptions.entryPoints,
        bundle: true,
        plugins: [
            {
                name: "get-idep",
                setup(build: PluginBuild) {
                    build.onResolve({ filter: decFilter }, (args) => {
                        handingFiles.add(args.importer);
                        return undefined;
                    });
                    build.onLoad({ filter: decFilter }, (args) => {
                        decFiles.add(args.path);
                        return undefined;
                    });
                },
            },
        ],
        write: false,
    });
}


