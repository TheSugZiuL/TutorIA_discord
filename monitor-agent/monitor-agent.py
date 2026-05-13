#!/usr/bin/env python3
"""Collects read-only VM and Docker status and pushes it to the monitor API."""

import json
import os
import platform
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request


AGENT_VERSION = "1.0.0"


def run(command, cwd=None, timeout=10):
    try:
        result = subprocess.run(
            command,
            cwd=cwd,
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout,
        )
    except Exception:
        return ""

    if result.returncode != 0:
        return ""

    return result.stdout.strip()


def parse_percent(value):
    try:
        return float(str(value).strip().replace("%", "").replace(",", "."))
    except ValueError:
        return None


def read_uptime_seconds():
    try:
        with open("/proc/uptime", "r", encoding="utf-8") as uptime_file:
            return float(uptime_file.read().split()[0])
    except Exception:
        return None


def read_memory():
    values = {}

    try:
        with open("/proc/meminfo", "r", encoding="utf-8") as meminfo:
            for line in meminfo:
                key, raw_value = line.split(":", 1)
                values[key] = int(raw_value.strip().split()[0]) * 1024
    except Exception:
        return {}

    total = values.get("MemTotal")
    available = values.get("MemAvailable")

    if not total or available is None:
        return {}

    used = max(0, total - available)

    return {
        "totalBytes": total,
        "availableBytes": available,
        "usedBytes": used,
        "usedPercent": round((used / total) * 100, 2),
    }


def read_disk():
    disk_path = os.environ.get("DISK_PATH", "/")

    try:
        usage = shutil.disk_usage(disk_path)
    except Exception:
        return {"path": disk_path}

    return {
        "path": disk_path,
        "totalBytes": usage.total,
        "usedBytes": usage.used,
        "freeBytes": usage.free,
        "usedPercent": round((usage.used / usage.total) * 100, 2),
    }


def parse_json_lines(output):
    items = []

    for line in output.splitlines():
        line = line.strip()

        if not line:
            continue

        try:
            items.append(json.loads(line))
        except json.JSONDecodeError:
            continue

    return items


def collect_container_stats():
    stats = {}
    output = run(["docker", "stats", "--no-stream", "--format", "{{json .}}"], timeout=15)

    for item in parse_json_lines(output):
        name = item.get("Name")

        if not name:
            continue

        stats[name] = {
            "cpuPercent": parse_percent(item.get("CPUPerc")),
            "memoryUsage": item.get("MemUsage", ""),
            "memoryPercent": parse_percent(item.get("MemPerc")),
        }

    return stats


def collect_containers():
    output = run(["docker", "ps", "-a", "--format", "{{json .}}"], timeout=10)
    stats = collect_container_stats()
    containers = []

    for item in parse_json_lines(output):
        name = item.get("Names", "")
        container_stats = stats.get(name, {})
        containers.append(
            {
                "name": name,
                "image": item.get("Image", ""),
                "state": item.get("State", ""),
                "status": item.get("Status", ""),
                "cpuPercent": container_stats.get("cpuPercent"),
                "memoryUsage": container_stats.get("memoryUsage", ""),
                "memoryPercent": container_stats.get("memoryPercent"),
            }
        )

    return containers


def collect_bot_status():
    container_name = os.environ.get("BOT_CONTAINER_NAME", "tutor-dev-bot")
    output = run(["docker", "inspect", container_name], timeout=10)

    if not output:
        return {"name": container_name, "state": "missing"}

    try:
        data = json.loads(output)[0]
    except Exception:
        return {"name": container_name, "state": "unknown"}

    state = data.get("State", {})
    health = state.get("Health", {})

    return {
        "name": data.get("Name", "/" + container_name).lstrip("/"),
        "image": data.get("Config", {}).get("Image", ""),
        "state": state.get("Status", ""),
        "status": "healthy" if health.get("Status") == "healthy" else state.get("Status", ""),
        "health": health.get("Status", ""),
        "restartCount": data.get("RestartCount"),
        "exitCode": state.get("ExitCode"),
        "startedAt": state.get("StartedAt", ""),
        "finishedAt": state.get("FinishedAt", ""),
        "error": state.get("Error", ""),
    }


def redact(line):
    patterns = [
        (r"sk-[A-Za-z0-9_-]{20,}", "[REDACTED_OPENAI_KEY]"),
        (r"mfa\.[A-Za-z0-9_-]{20,}", "[REDACTED_DISCORD_TOKEN]"),
        (r"[A-Za-z0-9_-]{24}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}", "[REDACTED_DISCORD_TOKEN]"),
        (r"Bearer\s+[A-Za-z0-9._~+/=-]+", "Bearer [REDACTED]"),
        (r"(DISCORD_TOKEN|OPENAI_API_KEY|MONITOR_AGENT_TOKEN)=\S+", r"\1=[REDACTED]"),
    ]
    value = line

    for pattern, replacement in patterns:
        value = re.sub(pattern, replacement, value)

    return value[-500:]


def collect_logs():
    try:
        tail_lines = int(os.environ.get("LOG_TAIL_LINES", "20"))
    except ValueError:
        tail_lines = 20

    if tail_lines <= 0:
        return []

    project_dir = os.environ.get("PROJECT_DIR", "/home/ubuntu/discord-tutor-bot")
    service_name = os.environ.get("BOT_SERVICE_NAME", "tutor-dev-bot")
    output = run(
        ["docker", "compose", "logs", "--no-color", "--tail", str(min(tail_lines, 80)), service_name],
        cwd=project_dir,
        timeout=15,
    )

    return [redact(line) for line in output.splitlines() if line.strip()]


def collect_status():
    load_average = []

    try:
        load_average = [round(value, 2) for value in os.getloadavg()]
    except Exception:
        pass

    return {
        "agentVersion": AGENT_VERSION,
        "reportedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "host": {
            "hostname": socket.gethostname(),
            "platform": platform.system(),
            "kernel": platform.release(),
            "architecture": platform.machine(),
        },
        "system": {
            "uptimeSeconds": read_uptime_seconds(),
            "loadAverage": load_average,
            "memory": read_memory(),
            "disk": read_disk(),
        },
        "docker": {
            "version": run(["docker", "--version"], timeout=6),
            "composeVersion": run(["docker", "compose", "version"], timeout=6),
        },
        "bot": collect_bot_status(),
        "containers": collect_containers(),
        "logs": collect_logs(),
    }


def post_status(status):
    endpoint = os.environ.get("MONITOR_ENDPOINT", "")
    token = os.environ.get("MONITOR_AGENT_TOKEN", "")

    if not endpoint or not token:
        print("MONITOR_ENDPOINT and MONITOR_AGENT_TOKEN are required", file=sys.stderr)
        return 2

    body = json.dumps(status, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": f"tutor-monitor-agent/{AGENT_VERSION}",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            if response.status >= 300:
                print(f"Monitor API returned HTTP {response.status}", file=sys.stderr)
                return 1
    except urllib.error.HTTPError as error:
        print(f"Monitor API returned HTTP {error.code}", file=sys.stderr)
        return 1
    except Exception as error:
        print(f"Monitor API request failed: {error}", file=sys.stderr)
        return 1

    return 0


def main():
    return post_status(collect_status())


if __name__ == "__main__":
    raise SystemExit(main())
