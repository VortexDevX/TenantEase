from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "apps" / "web" / "test-results" / "ui-audit"
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    for width, height, name in [(375, 812, "mobile"), (1440, 1000, "desktop")]:
        page = browser.new_page(viewport={"width": width, "height": height})
        page.set_default_timeout(90_000)
        page.set_default_navigation_timeout(90_000)
        errors = []
        page.on(
            "console",
            lambda message: errors.append(message.text)
            if message.type == "error" and "401 (Unauthorized)" not in message.text
            else None,
        )
        for route in ["login", "register"]:
            page.goto(f"http://localhost:3000/{route}", wait_until="domcontentloaded")
            page.wait_for_load_state("networkidle")
            page.screenshot(path=str(OUT / f"{route}-{name}.png"), full_page=True)
            assert page.locator("h1:visible").count() > 0, f"/{route} missing visible h1 at {name}; url={page.url}"
            overflow = page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
            assert not overflow, f"/{route} has horizontal overflow at {name}"
            page.keyboard.press("Tab")
            focused = page.evaluate("document.activeElement && document.activeElement.tagName")
            assert focused in {"A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"}, f"/{route} lacks keyboard focus target"
        assert not errors, f"browser console errors at {name}: {errors}"
        page.close()
    browser.close()

print(f"UI audit passed; screenshots: {OUT}")
