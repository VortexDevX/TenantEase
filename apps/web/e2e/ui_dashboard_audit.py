from pathlib import Path
from time import time
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / "apps" / "web" / "test-results" / "ui-audit"
OUT.mkdir(parents=True, exist_ok=True)
phone = f"9{str(int(time() * 1000))[-9:]}"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page.set_default_timeout(30_000)
    page.goto("http://localhost:3000/register", wait_until="domcontentloaded")
    page.get_by_label("Mobile number").fill(phone)
    page.get_by_role("button", name="Send OTP").click()
    page.get_by_text("Local debug OTP").wait_for()
    page.get_by_role("button", name="Create owner account").click()
    page.wait_for_timeout(2_000)
    if "/onboarding" not in page.url:
        page.screenshot(path=str(OUT / "registration-failure.png"), full_page=True)
        raise AssertionError(f"registration did not reach onboarding; url={page.url}; body={page.locator('body').inner_text()[:800]}")
    page.wait_for_url("**/onboarding")

    page.get_by_label("Full name").fill("Visual Audit Owner")
    page.get_by_label("Business or brand name").fill("Night Ledger PG")
    page.get_by_role("button", name="Continue to dashboard").click()

    page.get_by_label("Property name").fill(f"Ledger House {phone[-4:]}")
    page.get_by_label("PIN code").fill("560001")
    page.get_by_label("Full address").fill("1 Ledger Street")
    page.get_by_label("City").fill("Bengaluru")
    page.get_by_label("State").fill("Karnataka")
    page.get_by_role("button", name="Save").click()
    page.wait_for_timeout(2_000)
    if "/properties" not in page.url:
        page.screenshot(path=str(OUT / "property-create-failure.png"), full_page=True)
        raise AssertionError(f"property create did not reach properties; url={page.url}; body={page.locator('body').inner_text()[:800]}")
    page.goto("http://localhost:3000/", wait_until="domcontentloaded")
    page.get_by_role("heading", name="Daily Control").wait_for()
    assert not page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
    page.screenshot(path=str(OUT / "dashboard-desktop.png"), full_page=True)

    page.set_viewport_size({"width": 375, "height": 812})
    page.reload(wait_until="domcontentloaded")
    page.get_by_role("heading", name="Daily Control").wait_for()
    assert not page.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth")
    page.screenshot(path=str(OUT / "dashboard-mobile.png"), full_page=True)
    browser.close()

print(f"Authenticated UI audit passed; screenshots: {OUT}")
