import {
    Plugin,
    PluginBuild,
    build as esbuild,
    BuildResult,
    BuildOptions,
} from "esbuild";
import { ForStatement, Project } from "ts-morph";
import { ClassTypeInfo, MethodTypeInfo, PropTypeInfo } from "./type-info";

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
            await getDecFiles(
                build,
                handingFiles,
                decFiles,
                option.decFileFilter
            );

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
                    const clsDecors = cls
                        .getDecorators()
                        .filter((decor) => decNames.has(decor.getName()));
                    if (!clsDecors) continue;

                    const props = cls.getProperties();
                    const propInfoArr: PropTypeInfo[] = [];
                    for (const prop of props) {
                        const propDecors = prop
                            .getDecorators()
                            .filter((propDecor) =>
                                decNames.has(propDecor.getName())
                            );
                        if (propDecors.length <= 0) continue;
                        propInfoArr.push({
                            decors: propDecors,
                            target: prop,
                        });
                    }

                    const methods = cls.getMethods();
                    const methodInfoArr: MethodTypeInfo[] = [];
                    for (const method of methods) {
                        const methodDecor = method
                            .getDecorators()
                            .filter((methodDecor) =>
                                decNames.has(methodDecor.getName())
                            );
                        if (!methodDecor) continue;

                        methodInfoArr.push({
                            decors: methodDecor,
                            target: method,
                            params: method.getParameters().map((param) => {
                                const paramDecors = param
                                    .getDecorators()
                                    .filter((paramDecor) =>
                                        decNames.has(paramDecor.getName())
                                    );
                                return {
                                    target: param,
                                    decors: paramDecors,
                                };
                            }),
                        });
                    }

                    const classTypeInfo: ClassTypeInfo = {
                        decors: clsDecors,
                        target: cls,
                        properties: propInfoArr,
                        methods: methodInfoArr,
                    };

                    option.onProgress(build.initialOptions, classTypeInfo);
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
