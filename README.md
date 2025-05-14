# Flashcat CLI

Flashcat CLI 是一个用于支持 Flashcat 相关操作的命令行工具。  
Flashcat CLI is a command-line tool for supporting Flashcat-related operations.

详细文档请参见 [官方文档](https://docs.flashcat.cloud/zh/flashduty/introduction)。  
See the [documentation](https://docs.flashcat.cloud/zh/flashduty/rum/sourcemap) for more details.

---

## 安装 | Installation

```bash
npm install -g @flashcatcloud/flashcat-cli
```

---

## 快速开始 | Quick Start

### Sourcemap 上传 | Sourcemap Upload

```bash
flashcat-cli sourcemaps upload <filepath> --service <service> --minified-path-prefix <minified-path> --release-version <version>
```

**参数说明 | Option Descriptions:**

- `<filepath>`：需要上传的文件目录  
  File directory to upload
- `--service` (必填 | required)：服务名称  
  Service name
- `--minified-path-prefix` (必填 | required)：所有 JS 源文件的公共前缀，通常为它们部署后的 URL 或绝对路径  
  The common prefix for all JS source files, depending on their deployed URL. It can be a complete URL or an absolute path.
- `--release-version`：版本号  
  Version

---

## 功能特性 | Features

- 一键上传 sourcemap 文件，便于前端错误追踪  
  One-click upload of sourcemap files for easier frontend error tracking
- 支持多服务、多版本管理  
  Supports multiple services and version management
- 简单易用的命令行界面  
  Simple and user-friendly CLI

---


## 联系我们 | Contact

如有疑问或需求，欢迎通过 [issues](https://github.com/flashcatcloud/flashcat-cli/issues) 提交。
For questions or support, please open an [issue](https://github.com/flashcatcloud/flashcat-cli/issues).

---

## 许可证 | License

[Apache License, v2.0](./LICENSE)

---

## 引用 | Credits

本项目部分初始化代码基于 [datadog-ci](https://github.com/DATADOG/datadog-ci) 项目。  
Some of the initial code in this project is derived from the [datadog-ci](https://github.com/DATADOG/datadog-ci) project.

原始作品版权归 Datadog, Inc., 2020 所有。  
The original work is copyright Datadog, Inc., 2020.

本项目的修改部分版权归 Flashcat, Inc., 2025 所有。  
Modifications copyright Flashcat, Inc., 2025.