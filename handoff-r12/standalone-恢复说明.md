# 独立恢复指南（不依赖旧包）

从新链接下载五个文件，保留原名，把它们与 `PARTS.sha256`、`ARCHIVE.sha256`、`SOURCE.sha256` 放到同一个空文件夹。Mac 可用 `shasum -a 256`，Linux 可用 `sha256sum`。

```sh
shasum -a 256 -c PARTS.sha256
cat PF1-R12-6CFA-full-source.tar.gz.part00 PF1-R12-6CFA-full-source.tar.gz.part01 PF1-R12-6CFA-full-source.tar.gz.part02 PF1-R12-6CFA-full-source.tar.gz.part03 PF1-R12-6CFA-full-source.tar.gz.part04 > PF1-R12-6CFA-full-source.tar.gz
shasum -a 256 -c ARCHIVE.sha256
tar -xzf PF1-R12-6CFA-full-source.tar.gz
(cd client && shasum -a 256 -c ../SOURCE.sha256)
```

以 `client/` 作为项目根。所有 1,460 路径必须通过校验。这个完整包是开发源码，不是安装包。要复现扫码版本，可从源码增量 ZIP 中的 `preview-only/` 取同画面加载封面变体，并按其中说明对照预览输入校验清单；不要以旧 COW8D 的文件直接覆盖这里。

前一份项目 Skill、MCP 参考与早期沟通：[COW8D 历史交接](https://demon-and-elves-cow8d-handoff.whxh1987.chatgpt.site)。
