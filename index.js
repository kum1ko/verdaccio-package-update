require("colors")
const fs     = require("fs")
const mkdirp = require("mkdirp")
const path   = require("path")
const axios  = require("axios")
const loGet  = require("lodash/get")

const config = {
          VERDACCIO_STORAGE_DIR: "./storage",
          UPLINK_FETCH_TIMEOUT: 3000,
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
    for (let module of readDir) {
        // Exclude some files, such as verdaccio configuration
        if (module.match(/^(\.|@)/)) {
            continue
        }

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

            while (true) {
                try {
                    result = await axios({
                        url: "http://registry.npm.taobao.org/" + module,
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36",
                        },
                        timeout: config.UPLINK_FETCH_TIMEOUT,
                    })
                    break
                } catch (e) {
                    console.log(`${e.message}, retring...`);
                }
            }

            let uplinkLatest = loGet(result.data, '[dist-tags][latest]')

            if (!uplinkLatest) {
                console.log(`Error in getting upstream data: ${module}`.red);
                process.exit()
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

    if (modulesNeedUpdate.length) {
        console.log("Processed, these will be updated: " + modulesNeedUpdate.join(", ").green);
    } else {
        console.log("Finished processing, nothing here needs updating.".green);
    }

    // Write the package to the file
    fs.writeFileSync(targetPkgFile, JSON.stringify(pkg))
})()
