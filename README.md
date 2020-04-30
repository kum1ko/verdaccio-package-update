# verdaccio-package-update
这个repo是用来辅助Verdaccio，手动检测npm的包有无更新并且自动标记的工具

### 为什么要做这个
当本地安装deps时，Verdaccio检测到缓存过期，将会主动去上游获取数据，虽然在缓存周期内再次获取依赖将会命中缓存，但是首次运行的效率并不客观，我们需要一个机制去定时同步这个更新。
### 食用方法
首先配置好Verdaccio，方法这里不再赘述。
配置好后需要更改其缓存周期，位于`config.yaml`中：
```yaml
uplinks:
  npmjs:
    url: https://registry.npm.taobao.org
    maxage: 100y
```
这样当本地缓存了某个包时，将不会去上游获取数据。

之后配置好`.env`
```dotenv
VERDACCIO_STORAGE_DIR=/tmp/storage
UPLINK_FETCH_TIMEOUT=3000
```
执行命令：
```shell script
yarn 
node index
```
将会遍历所有缓存的包进行更新检查，如果检查到了更新，该脚本会删除包缓存的`package.json`文件，那么下次通过verdaccio获取这个依赖信息时将会触发更新。
最终需要更新的包会写入`dist/package.json`，可以直接运行`yarn`对其进行预更新。
