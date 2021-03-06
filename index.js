require("colors")
require('dotenv').config()
const fs     = require("fs")
const mkdirp = require("mkdirp")
const path   = require("path")
const axios  = require("axios")
const loGet  = require("lodash/get")

const config = {
          VERDACCIO_STORAGE_DIR: process.env.VERDACCIO_STORAGE_DIR || "/tmp/verdaccio/storage",
          UPLINK_FETCH_TIMEOUT: parseInt(process.env.UPLINK_FETCH_TIMEOUT || 3000),
          UPLINK_URL: process.env.UPLINK_URL || "http://registry.npmjs.org/",
      }

;(async () => {
    let storage       = config.VERDACCIO_STORAGE_DIR
    let readDir       = fs.readdirSync(storage);
    let targetPkgFile = path.join("dist", "package.json")

    if (!fs.existsSync(targetPkgFile)) {
        try {
            console.log("Creating target folder...".yellow);
            mkdirp.sync("dist")
            fs.writeFileSync(targetPkgFile, JSON.stringify(
                {
                    "name": "verdaccioCache",
                    "dependencies": {},
                },
            ))
            console.log("OK.".green);
        } catch (e) {
            console.error(e);
            process.exit()
        }
    }

    console.log("Packages being processed...".yellow);

    let pkg = fs.readFileSync(path.join("dist", "package.json"), "utf-8");

    pkg = JSON.parse(pkg)

    pkg["dependencies"]   = {}
    let modulesNeedUpdate = []

    async function checkUpdatedByModule(module) {
        console.log(module);

        let localLatest = undefined
        try {
            let modulePKG = fs.readFileSync(path.join(storage, module, "package.json"), "utf-8");
            modulePKG     = JSON.parse(modulePKG)

            localLatest = loGet(modulePKG, '[dist-tags][latest]')
        } catch (e) {

        }

        try {
            let result = {}

            let uplinkLatest = undefined
            while (true) {
                try {
                    result = await axios({
                        url: config.UPLINK_URL + module,
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36",
                        },
                        timeout: config.UPLINK_FETCH_TIMEOUT,
                    })
                } catch (e) {
                    console.log(`${e.message}, retring...`.red);
                    continue
                }

                uplinkLatest = loGet(result.data, '[dist-tags][latest]')

                if (!uplinkLatest) {
                    console.log(result.data);
                    console.log(`Error in getting upstream data: ${module}`.red);
                    continue
                }

                break
            }

            // If no Local `package.json` is read.
            // Or the versions don't match.
            if (!localLatest || uplinkLatest !== localLatest) {
                // Delete the local `package.json` so that next time it will automatically update the data from Uplinks
                console.log(`Update detected: ${module} ${localLatest} ${uplinkLatest}`.green);
                modulesNeedUpdate.push(module)

                try {
                    fs.unlinkSync(path.join(storage, module, "package.json"));
                } catch (e) {
                    console.log(`Error when deleting: ${module}`);
                }

                pkg.dependencies[module] = "latest"
            }

        } catch (e) {
            console.log(e);
        }
    }

    for (let module of readDir) {
        // Exclude some files, such as verdaccio configuration
        if (module.match(/^(\.)/)) {
            continue
        }

        if (module.indexOf("@") === 0) {
            // namespaced modules
            let scopedModules = fs.readdirSync(path.join(storage, module));
            for (let scopedModule of scopedModules) {
                await checkUpdatedByModule(`${module}/${scopedModule}`)
            }
            continue
        }

        await checkUpdatedByModule(module)

    }

    if (modulesNeedUpdate.length) {
        console.log("Processed, these will be updated: " + modulesNeedUpdate.join(", ").green);
    } else {
        console.log("Finished processing, nothing here needs updating.".green);
    }

    // Write the package to the file
    fs.writeFileSync(targetPkgFile, JSON.stringify(pkg))
})()
