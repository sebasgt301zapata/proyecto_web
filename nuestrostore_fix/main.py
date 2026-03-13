#!/usr/bin/env python3
# ──────────────────────────────────────────────────────
# NuestroStore — Django — punto de entrada
# ──────────────────────────────────────────────────────
import sys
import os
import subprocess
import socket
import threading
import platform
import stat
import re
import urllib.request
from pathlib import Path

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nuestrostore.settings')

IS_WIN = platform.system() == "Windows"

def col(txt, c):
    if IS_WIN: return txt
    m = {"r":"\033[91m","g":"\033[92m","y":"\033[93m","c":"\033[96m","b":"\033[1m","o":"\033[38;5;208m","x":"\033[0m"}
    return m.get(c,"") + txt + m["x"]

def sep(ch="═", n=56): print(col(ch*n, "o"))
def ok(m):   print(col("  ✅ " + m, "g"))
def warn(m): print(col("  ⚠  " + m, "y"))
def info(m): print(col("  ℹ  " + m, "c"))


def pip_install(pkg):
    try:
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", pkg, "--quiet",
             "--disable-pip-version-check", "--break-system-packages"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except Exception:
        return False


def asegurar_django():
    try:
        import django
        return True
    except ImportError:
        print("  📦 Instalando Django...")
        if pip_install("django"):
            ok("Django instalado")
            return True
        print("  ❌ Ejecuta: pip install django")
        return False


def local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


CF_DIR = Path.home() / ".nuestrostore"
CF_DIR.mkdir(exist_ok=True)


def cf_path():
    name = "cloudflared.exe" if IS_WIN else "cloudflared"
    for p in [Path(".") / name, CF_DIR / name]:
        if p.exists(): return str(p)
    import shutil
    found = shutil.which("cloudflared")
    if found: return found
    return str(CF_DIR / name)


def descargar_cf():
    dest = cf_path()
    if os.path.exists(dest): return dest
    sys_ = platform.system()
    arch = platform.machine().lower()
    urls = {
        ("Windows","x86_64"): "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe",
        ("Darwin","arm64"):   "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz",
        ("Darwin","x86_64"):  "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz",
        ("Linux","x86_64"):   "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64",
        ("Linux","aarch64"):  "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64",
    }
    norm = "x86_64" if ("arm" not in arch and "aarch" not in arch) else arch
    url  = urls.get((sys_, norm)) or urls.get((sys_, "x86_64"), "")
    if not url:
        warn("Sistema no soportado para descarga automática")
        return None
    print("  📥 Descargando cloudflared (solo una vez)...")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read()
        if url.endswith(".tgz"):
            import tarfile, io
            with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as tar:
                for m in tar.getmembers():
                    if "cloudflared" in m.name and not m.name.endswith("/"):
                        f = tar.extractfile(m)
                        if f:
                            with open(dest, "wb") as out: out.write(f.read())
                        break
        else:
            with open(dest, "wb") as f: f.write(data)
        if not IS_WIN:
            os.chmod(dest, os.stat(dest).st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
        ok("cloudflared descargado")
        return dest
    except Exception as e:
        warn(f"No se pudo descargar cloudflared: {e}")
        return None


tunnel_url = None


def iniciar_tunel(port, cfp):
    global tunnel_url
    try:
        proc = subprocess.Popen(
            [cfp, "tunnel", "--url", f"http://localhost:{port}"],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
        for line in proc.stdout:
            m = re.search(r"https://[\w\-\.]+\.(?:trycloudflare\.com|cfargotunnel\.com)\S*", line)
            if m:
                tunnel_url = m.group(0)
                print(); sep("★")
                print(col("  🌍  URL PUBLICA DE TU TIENDA:", "b"))
                print(); print(col(f"      {tunnel_url}", "c")); print()
                print(col("  Comparte este enlace con CUALQUIER PERSONA", "g"))
                print(col("  del mundo. Funciona en cualquier red.", "g"))
                print(); sep("★"); print(); return
    except Exception as e:
        warn(f"Error en túnel: {e}")


def main():
    sep()
    print(col("  🛒  NuestroStore v6 — Django + SQLite", "b"))
    sep()

    if not asegurar_django():
        sys.exit(1)

    import django
    django.setup()

    # Inicializar BD
    from tienda.database import init_db, get_db_path
    info(f"Base de datos: {get_db_path()}")
    init_db()
    ok("Base de datos SQLite lista")

    # Buscar puerto libre
    port = 8000
    for p in range(8000, 8020):
        with socket.socket() as s:
            if s.connect_ex(("127.0.0.1", p)) != 0:
                port = p; break

    ip = local_ip()
    sep()
    print(col(f"  🖥️  Red local: http://{ip}:{port}", "c"))
    print(col(f"  🏠  Local:     http://127.0.0.1:{port}", "c"))
    sep()
    print()
    print(col("  🔐 CREDENCIALES DE ACCESO (solo visibles aquí en consola)", "y"))
    print(col("  ─────────────────────────────────────────────────────────", "y"))
    print(col("  SuperAdmin : superadmin@tienda.com  /  Admin@2024", "g"))
    print(col("  Admin      : carlos@admin.com       /  Admin@2024", "g"))
    print(col("  Cliente    : ana@cliente.com         /  cliente123", "g"))
    print()
    print(col("  🔒 Contraseñas almacenadas con PBKDF2+SHA256 (hash)", "c"))
    print(col("  🛡️  API protegida contra SQL injection", "c"))
    print(col("  🐍  Backend: Django " + django.__version__, "c"))
    print()

    # Túnel Cloudflare
    cfp = descargar_cf()
    if cfp:
        t = threading.Thread(target=iniciar_tunel, args=(port, cfp), daemon=True)
        t.start()
    else:
        warn("Sin túnel público. Solo acceso local/red.")

    # Iniciar Django development server
    from django.core.management import call_command
    info("Presiona Ctrl+C para detener el servidor")
    print()
    try:
        call_command('runserver', f'0.0.0.0:{port}', '--noreload', '--nothreading')
    except KeyboardInterrupt:
        print(); info("Servidor detenido.")


if __name__ == "__main__":
    main()
