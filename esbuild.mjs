import esbuild from "esbuild";
import fs from "fs";
const packageJSON = JSON.parse(fs.readFileSync("./package.json"));

const external = [
    ...Object.keys(packageJSON.dependencies),
    ...Object.keys(packageJSON.peerDependencies),
];
esbuild.buildSync({
    entryPoints: ["src/index.ts"],
    format: "esm",
    outfile: "dist/index.esm.js",
    bundle: true,
    platform: "node",
    external,
});

esbuild.buildSync({
    entryPoints: ["src/index.ts"],
    format: "cjs",
    outfile: "dist/index.cjs.js",
    bundle: true,
    platform: "node",
    external,
});
