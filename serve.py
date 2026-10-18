# -*- coding: utf-8 -*-
"""F-FRRS 本地开发服务器：与 python -m http.server 等价，但禁用缓存。
浏览器 heuristic 缓存曾导致修改后的 JS/CSS 不生效（页面仍运行旧版本），
因此所有响应统一加 Cache-Control: no-store。
用法: python serve.py [port]   （默认 8080）
"""
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, format, *args):  # 保持与 http.server 一致的访问日志
        super().log_message(format, *args)


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    print(f"Serving F-FRRS at http://localhost:{port} (no-cache)")
    HTTPServer(("0.0.0.0", port), NoCacheHandler).serve_forever()
