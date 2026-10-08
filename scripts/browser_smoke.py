"""Exercise the running local demo and capture portfolio walkthrough screenshots."""
import argparse
import json
import os
import time
import urllib.request
import urllib.error
import uuid
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default='http://127.0.0.1:5001')
    args = parser.parse_args()
    if args.url not in {'http://127.0.0.1:5001', 'http://localhost:5001'}:
        parser.error('This test is restricted to the local demo on port 5001.')
    output = ROOT / 'docs/images'
    output.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as runtime:
        chrome = os.getenv('BROWSER_EXECUTABLE', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
        options = {'headless': True}
        if Path(chrome).exists():
            options['executable_path'] = chrome
        browser = runtime.chromium.launch(**options)
        page = browser.new_page(viewport={'width': 1440, 'height': 1000}, timezone_id='America/Los_Angeles')
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(args.url)
        expect(page.get_by_role('heading', name='Welcome back.')).to_be_visible()
        page.screenshot(path=str(output / '01-sign-in.png'), full_page=True)
        page.get_by_role('button', name='Sign in', exact=True).click()
        expect(page.get_by_role('heading', name='Keep the response moving.')).to_be_visible()
        expect(page.get_by_role('button', name='Refresh', exact=False)).to_be_enabled()
        page.screenshot(path=str(output / '02-workspace.png'), full_page=True)
        page.get_by_role('button', name='+ Create incident', exact=True).click()
        title = 'Checkout latency after gateway rollout ' + uuid.uuid4().hex[:6]
        dialog = page.get_by_role('dialog', name='Create an incident')
        dialog.get_by_label('Title', exact=True).fill(title)
        dialog.get_by_label('Description', exact=True).fill('Synthetic lab incident: investigate a delayed query and capture evidence before proposing a cause.')
        dialog.get_by_label('Service', exact=True).fill('Payments')
        dialog.get_by_label('Severity', exact=True).select_option('SEV2')
        dialog.get_by_label('Owner', exact=True).select_option(label='Priya Shah')
        dialog.screenshot(path=str(output / '03-create-incident.png'))
        dialog.get_by_role('button', name='Create incident', exact=True).click()
        expect(dialog).not_to_be_visible()
        detail = page.get_by_role('complementary', name='Incident details')
        expect(detail.get_by_role('heading', name=title, exact=True)).to_be_visible()
        detail.get_by_label('Response status', exact=True).select_option('In Progress')
        detail.get_by_role('button', name='Update status', exact=True).click()
        expect(page.get_by_role('status')).to_have_text('Incident updated.')
        expect(detail.get_by_label('Response note', exact=True)).to_be_enabled()
        expect(detail.get_by_label('Response status', exact=True)).to_have_value('In Progress')
        detail.get_by_label('Response note', exact=True).fill('Compared deployment timing and checked ownership. Capturing a lab query to verify the trace path.')
        detail.get_by_role('button', name='Add note', exact=True).click()
        expect(page.get_by_role('status')).to_have_text('Response note added.')
        expect(detail.get_by_label('Response note', exact=True)).to_have_value('')
        detail.screenshot(path=str(output / '04-response-history.png'))
        detail.get_by_role('button', name='Capture HTTP failure', exact=True).click()
        expect(detail.get_by_text('Deliberate lab HTTP 500: injected request failure.', exact=True)).to_be_visible()
        detail.get_by_role('button', name='Capture slow query', exact=True).click()
        expect(detail.get_by_text('Deliberate lab query delay: SELECT pg_sleep(0.3) completed.', exact=True)).to_be_visible()
        detail.get_by_role('button', name='Generate rule-based summary', exact=True).click()
        expect(detail.get_by_role('heading', name='A deliberately delayed database query increased request latency in the lab.', exact=True)).to_be_visible()
        detail.screenshot(path=str(output / '05-evidence-and-triage.png'))
        traces = detail.get_by_role('link', name='View trace in Jaeger ↗', exact=True)
        assert traces.count() == 2, 'Expected a trace link for each captured event'
        trace_id = traces.nth(0).get_attribute('href').rsplit('/', 1)[-1]
        deadline = time.monotonic() + 25
        while True:
            try:
                with urllib.request.urlopen('http://127.0.0.1:16686/api/traces/' + trace_id, timeout=3) as response:
                    payload = json.load(response)
            except urllib.error.HTTPError as error:
                if error.code != 404:
                    raise
                payload = {}
            if payload.get('data'):
                break
            if time.monotonic() >= deadline:
                raise AssertionError('Trace did not arrive in Jaeger')
            time.sleep(1)
        trace_page = browser.new_page(viewport={'width': 1440, 'height': 1000})
        trace_page.goto('http://127.0.0.1:16686/trace/' + trace_id)
        expect(trace_page.get_by_text('ops-incident-api', exact=False).first).to_be_visible()
        trace_page.screenshot(path=str(output / '06-jaeger-trace.png'), full_page=True)
        detail.get_by_label('Response status', exact=True).select_option('Resolved')
        detail.get_by_role('button', name='Update status', exact=True).click()
        expect(detail.get_by_label('Response status', exact=True)).to_have_value('Resolved')
        page.locator('header').scroll_into_view_if_needed()
        page.screenshot(path=str(output / '07-resolved.png'), full_page=True)
        page.get_by_label('Search incidents', exact=True).fill(title)
        expect(page.locator('.incident-row')).to_have_count(1)
        page.set_viewport_size({'width': 390, 'height': 844})
        expect(page.get_by_role('heading', name='Keep the response moving.')).to_be_visible()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile overflow'
        page.locator('header').scroll_into_view_if_needed()
        page.screenshot(path=str(output / '08-mobile.png'), full_page=True)
        assert not errors, errors
        browser.close()
        print(json.dumps({'flows': ['login','create','assign','status','comment','http_error','slow_query','triage','resolve','search','mobile'], 'javascript_errors': errors, 'jaeger_trace_verified': trace_id, 'screenshots': str(output)}, indent=2))


if __name__ == '__main__':
    main()
