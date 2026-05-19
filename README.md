# HiTerm

[中文](./README_zh_CN.md) | **English**

> 💻 An easy-to-use, aesthetically pleasing, and versatile shell management app — brought to you by [Guzyeah Studio](https://www.guzyeah.cn).

HiTerm is a cross-platform desktop terminal application built with **Fluent UI**. It unifies local and remote shell management in one elegant interface.

---

## ✨ Features

### 🔌 Multi-Protocol Connection Manager
| Protocol | Description |
|----------|-------------|
| **SSH** | Remote shell with password / private key authentication |
| **Local** | Built-in system terminals (`cmd`, `PowerShell`, `Git Bash`, `bash`, `zsh`, `sh`) |
| **Telnet** | Legacy telnet connections |
| **Serial** | Serial port terminal with configurable baud rate, parity, flow control, etc. |
| **VNC** | Remote desktop access |
| **RDP** | Remote desktop protocol |

### 📂 Connection Grouping
Organize your connections into custom groups. The tree view groups connections visually and supports right-click deletion (only empty groups can be removed).

### 🖥️ Terminal
- Support for **font family**, **font size**, and **font ligatures** configuration
- Multiple built-in terminal themes (e.g. `Windows Console Dark`, `Solarized`, etc.)
- Terminal view modes: **Normal**, **Maximized**, **Fullscreen**
- Command history capture and replay per session

### 📁 Built-in File Browser
Bidirectional file transfer between local and remote hosts:
- Browse directories, view file metadata
- Upload / download files and folders with progress indication
- Create, delete, rename files and directories
- Support for both local and SSH remote file systems

### 📊 System Resource Monitor (Status Bar)
Real-time system metrics displayed in the bottom status bar:
- **CPU** usage with mini trend chart
- **Memory** usage
- **Network** upload / download rates
- **Disk** read / write rates and overall usage
- All metrics update every 2 seconds

### 📜 Command History
Per-session command history with:
- Search and filter
- Copy command to clipboard
- Re-run a previous command
- Delete individual records

### 🗂️ Tabbed Workspace
- Multi-tab terminal workspace
- Dock tabs on left or top
- Each tab maintains its own independent terminal session

### 🎨 Fluent Design UI
- Built entirely with [Fluent UI React Components](https://react.fluentui.dev/)
- **Light** / **Dark** / **System** theme support
- Subtle animations and smooth transitions
- Accessible and keyboard-friendly

### 🌐 Internationalization (i18n)
| Language | Code |
|----------|------|
| English | `en` |
| Simplified Chinese | `zh-CN` |
| Traditional Chinese | `zh-TW` |
| Japanese | `ja` |
| Korean | `ko` |
| French | `fr` |
| German | `de` |
| Italian | `it` |
| Spanish | `es` |
| Arabic | `ar` |
| Vietnamese | `vi` |

### 🔒 Security
- Sensitive fields (passwords, private keys) are encrypted
- Dual licensing: **AGPL-3.0-only** (open-source) or **Commercial Proprietary License**


## 📄 License

HiTerm is dual-licensed:

1. **AGPL-3.0-only** — See [LICENSE.AGPL](./LICENSE.AGPL) for details.
2. **Commercial Proprietary License** — Contact [guzyeah@foxmail.com](mailto:guzyeah@foxmail.com) for commercial use.

---

<p align="center">Made with ❤️ by <a href="https://www.guzyeah.cn">Guzyeah Studio</a></p>
