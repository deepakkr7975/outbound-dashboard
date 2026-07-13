"""
Browser simulation tests for the Outbound Dashboard.

Drives a real (non-headless) Chrome window through every dashboard page and
the /test-database page, asserting that live data from the FastAPI/DynamoDB
backend actually renders. After each page test a screenshot is saved to
simulate-test/ss/ and a line is appended to simulate-test/test_log.txt.

Prerequisites:
  - FastAPI backend running on http://127.0.0.1:8000
  - Next.js dev server running (default http://localhost:3001)
  - Google Chrome installed (chromedriver resolved by Selenium Manager)

Run:  fastapi-backend/venv/Scripts/python simulate-test/run_tests.py
"""
import os
import sys
import time
from datetime import datetime

import requests
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL = os.getenv("TEST_BASE_URL", "http://localhost:3001")
API_URL = os.getenv("TEST_API_URL", "http://127.0.0.1:8000")

HERE = os.path.dirname(os.path.abspath(__file__))
SS_DIR = os.path.join(HERE, "ss")
LOG_FILE = os.path.join(HERE, "test_log.txt")

os.makedirs(SS_DIR, exist_ok=True)


def log(line):
    stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    entry = f"[{stamp}] {line}"
    print(entry)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(entry + "\n")


def fetch_fixture_ids():
    """Pull real entity ids/names from the API so detail pages are tested
    against whatever is actually in DynamoDB."""
    leads = requests.get(f"{API_URL}/leads?limit=5", timeout=15).json()["leads"]
    audiences = requests.get(f"{API_URL}/audiences", timeout=15).json()["audiences"]
    campaigns = requests.get(f"{API_URL}/campaigns", timeout=15).json()["campaigns"]
    sequences = requests.get(f"{API_URL}/sequences", timeout=15).json()

    # Prefer the seeded demo campaign (it has transactions to render)
    campaign = next((c for c in campaigns if c["id"] == "camp_winter"), campaigns[0])
    audience = next(
        (a for a in audiences if a["name"] == "Internship"), audiences[0]
    )
    sequence = next(
        (s for s in sequences if s["sequence_id"] == "seq_winter"), sequences[0]
    )
    lead = next(
        (l for l in leads if l.get("name") == "Emma Davis"), leads[0]
    )
    return {
        "lead": lead,
        "audience": audience,
        "campaign": campaign,
        "sequence": sequence,
    }


class PageTest:
    def __init__(self, name, path, expected_texts, settle_seconds=1.0):
        self.name = name
        self.path = path
        self.expected_texts = expected_texts
        self.settle_seconds = settle_seconds


def run_page_test(driver, index, test):
    url = f"{BASE_URL}{test.path}"
    shot = os.path.join(SS_DIR, f"{index:02d}_{test.name}.png")
    status, detail = "PASS", "all checks passed"
    try:
        driver.get(url)
        for expected in test.expected_texts:
            WebDriverWait(driver, 25).until(
                lambda d, needle=expected: needle in d.page_source,
                message=f"expected text not found: {expected!r}",
            )
        time.sleep(test.settle_seconds)  # let charts/animations settle for the screenshot
    except Exception as e:
        status = "FAIL"
        detail = str(e).splitlines()[0][:300]
    finally:
        try:
            driver.save_screenshot(shot)
        except Exception as e:
            detail += f" (screenshot failed: {e})"
    log(
        f"TEST {index:02d} {test.name:<24} | {url} | {status} | {detail} | "
        f"screenshot=ss/{os.path.basename(shot)}"
    )
    return status == "PASS"


def main():
    log("=" * 100)
    log(f"Simulation test run started | base={BASE_URL} | api={API_URL}")

    try:
        fixtures = fetch_fixture_ids()
    except Exception as e:
        log(f"FATAL: could not fetch fixture ids from API: {e}")
        sys.exit(1)

    lead = fixtures["lead"]
    audience = fixtures["audience"]
    campaign = fixtures["campaign"]
    sequence = fixtures["sequence"]

    tests = [
        PageTest(
            "dashboard-overview", "/dashboard",
            ["Total Sends", "Active Campaigns", campaign["name"]],
        ),
        PageTest(
            "leads", "/dashboard/leads",
            [lead["name"], lead["email"], lead["company"]],
        ),
        PageTest(
            "lead-detail", f"/dashboard/leads/{lead['id']}",
            [lead["name"], "Contact Info", "Engagement"],
        ),
        PageTest(
            "audiences", "/dashboard/audiences",
            [audience["name"]],
        ),
        PageTest(
            "audience-detail", f"/dashboard/audiences/{audience['id']}",
            [audience["name"]],
        ),
        PageTest(
            "campaigns", "/dashboard/campaigns",
            [campaign["name"], sequence["name"], audience["name"]],
        ),
        PageTest(
            "campaign-detail", f"/dashboard/campaigns/{campaign['id']}",
            [campaign["name"], audience["name"]],
        ),
        PageTest(
            "sequences", "/dashboard/sequences",
            [sequence["name"]],
        ),
        PageTest(
            "sequence-detail", f"/dashboard/sequences/{sequence['sequence_id']}",
            [sequence["name"], "Email timeline"],
        ),
        PageTest(
            "sequence-builder-new", "/dashboard/sequences/new",
            ["New Sequence", "Email chain"],
        ),
        PageTest(
            "sender-emails", "/dashboard/sender-emails",
            ["outreach@revtrix.in", "Sender Emails"],
        ),
        PageTest(
            "analytics", "/dashboard/analytics",
            ["Analytics", campaign["name"]],
            settle_seconds=2.0,
        ),
        PageTest(
            "export", "/dashboard/export",
            ["Export"],
        ),
        PageTest(
            "account", "/dashboard/account",
            ["Account", "Profile"],
        ),
        PageTest(
            "settings", "/dashboard/settings",
            ["Settings"],
        ),
        PageTest(
            "test-database", "/test-database",
            [
                "Test Database",
                "email_accounts",
                "leads",
                "audiences",
                "sequences",
                "campaigns",
                "email_transactions",
                "scheduled_emails",
                "email_logs",
                "email_events",
                "items",
            ],
            settle_seconds=2.0,
        ),
    ]

    options = Options()
    # Real visible Chrome window — intentionally NOT headless.
    options.add_argument("--window-size=1600,1000")
    options.add_argument("--disable-notifications")
    driver = webdriver.Chrome(options=options)

    passed = 0
    try:
        for i, test in enumerate(tests, start=1):
            if run_page_test(driver, i, test):
                passed += 1
    finally:
        driver.quit()

    total = len(tests)
    log(f"Simulation test run finished: {passed}/{total} passed")
    log("=" * 100)
    sys.exit(0 if passed == total else 1)


if __name__ == "__main__":
    main()
