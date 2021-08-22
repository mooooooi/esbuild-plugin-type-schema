import { Plugin, PluginBuild, build as esbuild, BuildResult } from "esbuild";
import { Project } from "ts-morph";
import { ClassTypeInfo, MethodTypeInfo, PropTypeInfo } from "./type-info";
export abstract class TypeSchema implements Plugin {
    name = "TypeSchema";
    async _setup(build: PluginBuild) {
        const handingFiles = new Set<string>();
        const decFiles = new Set<string>();
        build.onStart(() => this.onStart());
        build.onEnd((result) => this.onEnd(result));

        const project = new Project();
        const decNames = new Set<string>();
        await this.getDecFiles(build, handingFiles, decFiles);

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
                        .find((propDecor) => decNames.has(propDecor.getName()));
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

                this.onProgress(classTypeInfo);
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
    }

    setup = this._setup.bind(this);
    async getDecFiles(
        build: PluginBuild,
        handingFiles: Set<string>,
        decFiles: Set<string>
    ) {
        const decFilter = this.getDecFilter();
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

    getDecFilter() {
        return /.dec/;
    }

    onStart() {}
    onProgress(classTypeInfo: ClassTypeInfo) {}
    onEnd(result: BuildResult) {}
}
