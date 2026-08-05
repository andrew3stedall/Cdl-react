from pathlib import Path
import re


interactions_path = Path("scripts/test-app-interactions.mjs")
interactions = interactions_path.read_text(encoding="utf-8")
replacement = """async function testUnauthenticatedGuard(page) {
  await page.reload({ waitUntil: 'networkidle' });
  await page.goto(baseUrl + '/team-selection', { waitUntil: 'networkidle' });
  await expectPath(page, '/login');
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  await page.getByText('Castle Draft League', { exact: true }).waitFor();
  await page.getByLabel('Email address').waitFor();
  await page.getByLabel('Password').waitFor();

  if (await page.getByRole('navigation', { name: 'Primary navigation' }).count() !== 0) {
    throw new Error('The login page must not expose authenticated application navigation.');
  }
}"""
interactions, count = re.subn(
    r"async function testUnauthenticatedGuard\(page, viewportName\) \{.*?\n\}\n\nasync function testLoginAndLogout",
    replacement + "\n\nasync function testLoginAndLogout",
    interactions,
    flags=re.S,
)
if count == 1:
    interactions_path.write_text(interactions, encoding="utf-8")
elif "async function testUnauthenticatedGuard(page)" not in interactions:
    raise SystemExit(f"Expected one unauthenticated guard function, replaced {count}")

screenshots_path = Path("scripts/capture-app-screenshots.mjs")
screenshots = screenshots_path.read_text(encoding="utf-8")
if "const unauthenticatedScreenshotSession" not in screenshots:
    screenshots = screenshots.replace(
        "const screenshotTeamSelection = {",
        "const unauthenticatedScreenshotSession = {\n"
        "  is_authenticated: false,\n"
        "  user: null,\n"
        "  expires_at: null,\n"
        "};\n\n"
        "const screenshotTeamSelection = {",
        1,
    )
    screenshots = screenshots.replace(
        "async function mockApi(page) {",
        "async function mockApi(page, authenticated = true) {",
        1,
    )
    screenshots = screenshots.replace(
        "return route.fulfill({ json: screenshotSession });",
        "return route.fulfill({ json: authenticated ? screenshotSession : unauthenticatedScreenshotSession });",
        1,
    )
    screenshots = screenshots.replace(
        "    if (path === '/api/squad/summary') {",
        "    if (path === '/api/auth/google/config') {\n"
        "      return route.fulfill({\n"
        "        json: authenticated\n"
        "          ? { enabled: false, client_id: null }\n"
        "          : { enabled: true, client_id: 'screenshot-client' },\n"
        "      });\n"
        "    }\n\n"
        "    if (path === '/api/squad/summary') {",
        1,
    )

    old_capture = """    for (const [name, route] of routes) {
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
      await assertAccessibilityAndKeyboard(page, name, viewport.name);
      await assertLayoutSafety(page, name, viewport.name);
      await page.screenshot({ path: `${viewportDir}/${name}.png`, fullPage: true });
    }

    await context.close();"""
    new_capture = """    for (const [name, route] of routes) {
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
      await assertAccessibilityAndKeyboard(page, name, viewport.name);
      await assertLayoutSafety(page, name, viewport.name);
      await page.screenshot({ path: `${viewportDir}/${name}.png`, fullPage: true });
    }

    await context.close();

    const loginContext = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: viewport.deviceScaleFactor,
    });
    const loginPage = await loginContext.newPage();
    await loginPage.route('https://accounts.google.com/gsi/client', async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: `window.google = { accounts: { id: {
          initialize() {},
          renderButton(parent) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = 'Sign in with Google';
            button.setAttribute('aria-label', 'Sign in with Google');
            button.style.width = '100%';
            button.style.minHeight = '44px';
            button.style.border = '1px solid rgba(148, 163, 184, 0.35)';
            button.style.borderRadius = '12px';
            button.style.background = '#ffffff';
            button.style.color = '#172033';
            button.style.fontWeight = '700';
            button.style.cursor = 'pointer';
            parent.append(button);
          },
        } } };`,
      });
    });
    await mockApi(loginPage, false);
    await loginPage.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
    await loginPage.getByRole('heading', { name: 'Welcome back' }).waitFor();
    await loginPage.getByRole('button', { name: 'Sign in with Google' }).waitFor();
    await assertAccessibilityAndKeyboard(loginPage, 'login', viewport.name);
    await assertLayoutSafety(loginPage, 'login', viewport.name);
    await loginPage.screenshot({ path: `${viewportDir}/login.png`, fullPage: true });
    await loginContext.close();"""
    if old_capture not in screenshots:
        raise SystemExit("Could not find screenshot capture loop")
    screenshots = screenshots.replace(old_capture, new_capture, 1)
    screenshots_path.write_text(screenshots, encoding="utf-8")

docs_test_path = Path("tests/test_github_app_screenshots_docs.py")
docs_test = docs_test_path.read_text(encoding="utf-8")
if "LOGIN_PAGE = Path" not in docs_test:
    docs_test = docs_test.replace(
        'APP = Path("frontend/src/App.tsx")\n',
        'APP = Path("frontend/src/App.tsx")\nLOGIN_PAGE = Path("frontend/src/LoginPage.tsx")\n',
        1,
    )
    docs_test = docs_test.replace(
        'for route in ["/", "/league", "/dashboard", "/fdr", "/squad-management", "/team-selection"]:',
        'for route in ["/", "/login", "/league", "/dashboard", "/fdr", "/squad-management", "/team-selection"]:',
        1,
    )
    docs_test = docs_test.replace(
        '    app = APP.read_text(encoding="utf-8")\n',
        '    app = APP.read_text(encoding="utf-8")\n    login_page = LOGIN_PAGE.read_text(encoding="utf-8")\n',
        1,
    )
    docs_test = docs_test.replace('"Sign in to CDL Manager"', '"Welcome back"')
    docs_test = docs_test.replace('assert "Email address" in app', 'assert "Email address" in login_page')
    docs_test = docs_test.replace('assert "current-password" in app', 'assert "current-password" in login_page')
    docs_test = docs_test.replace(
        'assert "VITE_STATIC_PREVIEW" in main',
        'assert "VITE_STATIC_PREVIEW" in main\n    assert "./login-page.css" in main',
        1,
    )
    docs_test_path.write_text(docs_test, encoding="utf-8")
