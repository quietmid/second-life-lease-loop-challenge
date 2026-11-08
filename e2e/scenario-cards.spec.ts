import { expect, test, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

async function signLease(page: Page, url: string, term: string) {
  await page.goto(url);
  await page.getByLabel('Lease term').selectOption(term);
  await page.getByRole('button', { name: 'Continue to application' }).click();
  const usageQuestion = page.locator('form').last().locator('select').last();
  if (url.includes('ebike-')) {
    await usageQuestion.selectOption('commuting');
    await expect(usageQuestion).toHaveValue('commuting');
  }
  await page.getByRole('button', { name: 'Review simulated decision' }).click();
  await page.getByRole('button', { name: 'Simulate a successful check' }).click();
  await page.getByRole('button', { name: 'Continue to simulated signing' }).click();
  await page.getByRole('button', { name: 'Confirm simulated signing' }).click();
}

test('all ten scenario cards open a usable customer or admin view', async ({ page }) => {
  await page.goto('/en/scenarios');
  await expect(page.getByRole('heading', { name: 'Challenge scenario cards' })).toBeVisible();
  const assetForScenario: Record<number, string> = {
    1: 'ebike-003',
    2: 'laptop-004',
    3: 'ebike-001',
    4: 'laptop-001',
    5: 'laptop-008',
    6: 'ebike-004',
    7: 'farm-002',
  };
  for (let number = 1; number <= 10; number += 1) {
    const card = page.getByTestId(`scenario-card-${number}`);
    await expect(card).toBeVisible();
    const link = card.getByRole('link');
    await expect(link).toBeVisible();
    await link.click();
    await expect(page.locator('main')).toBeVisible();
    if (number < 8) {
      await expect(page).toHaveURL(new RegExp(`/en/quote/${assetForScenario[number]}\\?`));
      await expect(page.getByRole('heading', { name: 'Configure your demo lease' })).toBeVisible();
    }
    if (number === 8) await expect(page).toHaveURL(/\/en\/leases\?/);
    if (number === 9 || number === 10)
      await expect(page).toHaveURL(new RegExp(`return-ebike-00${number === 9 ? '7' : '8'}`));
    await page.goto('/en/scenarios');
  }
});

test('scenario gallery works on mobile, by keyboard, and in all four locales', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en/scenarios');
  await expect(page.getByTestId('scenario-card-1')).toBeVisible();
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
  const firstScenarioLink = page.getByTestId('scenario-card-1').getByRole('link');
  await firstScenarioLink.focus();
  await expect(firstScenarioLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/en\/quote\/ebike-003\?/);

  for (const locale of ['en', 'fi', 'sv', 'et']) {
    await page.goto(`/${locale}/scenarios`);
    await expect(page.getByTestId('scenario-card-1')).toBeVisible();
  }
  await page.goto('/en/catalogue?profile=cust-aino&date=not-a-date');
  await expect(page.getByRole('alert').first()).toBeVisible();
});

test('scenarios 1 and 8 complete Aino lease, invoice, and early-exit journeys', async ({
  page,
}) => {
  await signLease(page, '/en/quote/ebike-003?profile=cust-aino&date=2026-11-05', '36');
  await expect(page).toHaveURL(/\/en\/account\?/);
  await expect(page.locator('#main').getByText('Aino Virtanen')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Trail 500' })).toBeVisible();
  await page.getByRole('link', { name: 'My transactions' }).first().click();
  await expect(page).toHaveURL(/\/en\/transactions\?/);
  await expect(page.getByText('Upcoming').first()).toBeVisible();
  await page.getByLabel('Payment method').first().selectOption('mobilepay');
  await page.getByRole('button', { name: 'Pay (demo)' }).first().click();
  await expect(page.getByText('Paid (demo)').first()).toBeVisible();
  await page.goto('/en/admin?profile=admin&date=2026-11-05&tab=invoices');
  await expect(page.getByText('Paid (demo)').first()).toBeVisible();
  await expect(page.getByText('MobilePay').first()).toBeVisible();
  await page.goto('/en/leases?profile=cust-aino&date=2026-11-05');
  await expect(page.getByRole('row')).toHaveCount(38);
  await expect(page.getByText('2026-11-05').first()).toBeVisible();

  await page.goto('/en/account?profile=cust-aino&date=2027-06-05');
  await expect(page.getByRole('heading', { name: 'End this lease early' })).toBeVisible();
  await page.getByRole('button', { name: 'Calculate settlement' }).click();
  await expect(page.getByText(/Estimated early-exit settlement/)).toBeVisible();
  await page.getByLabel('Condition when returned').selectOption('fair');
  await page.getByLabel('Usage counter when returned').fill('7200');
  await page.getByRole('button', { name: 'Confirm early return and settlement' }).click();
  await expect(page.getByRole('status')).toContainText('Early return recorded');
  await page.goto('/en/admin?profile=admin&date=2027-06-05&tab=returns');
  await expect(page.locator('#return-ebike-003')).toContainText('Early return');
  await expect(page.locator('#return-ebike-003')).toContainText('Customer reported at return');
  await expect(page.locator('#return-ebike-003')).toContainText('7,200');
});

test('scenarios 2, 3, and 4 show locked pricing, VAT timing, and calendar invoices', async ({
  page,
}) => {
  await page.goto('/en/quote/laptop-004?profile=cust-aino&date=2026-11-05');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue to application' }).click();
  await expect(page).toHaveURL(/\/en\/application\//);
  await page.goto(page.url().replace('2026-11-05', '2026-11-06'));
  await expect(page.getByText('The quoted price is locked for this signing date.')).toBeVisible();
  await page.getByRole('button', { name: 'Review simulated decision' }).click();
  await page.getByRole('button', { name: 'Simulate a successful check' }).click();
  await page.getByRole('button', { name: 'Continue to simulated signing' }).click();
  await page.getByRole('button', { name: 'Confirm simulated signing' }).click();
  await page.getByRole('link', { name: 'View lease and invoices' }).first().click();
  await expect(page.getByText('2026-11-06').first()).toBeVisible();

  await signLease(page, '/en/quote/ebike-001?profile=cust-aino&date=2026-09-15', '24');
  await page.getByRole('link', { name: 'View lease and invoices' }).first().click();
  const vatLease = page.getByRole('heading', { name: 'Urban 1' }).locator('xpath=..');
  await expect(vatLease.getByRole('row').filter({ hasText: '2026-12-01' })).toContainText('25.5%');
  await expect(vatLease.getByRole('row').filter({ hasText: '2027-01-01' })).toContainText('26%');

  await signLease(page, '/en/quote/laptop-001?profile=cust-aino&date=2026-01-31', '36');
  await page.getByRole('link', { name: 'View lease and invoices' }).first().click();
  const calendarLease = page.getByRole('heading', { name: 'Compute Air 13' }).locator('xpath=..');
  await expect(calendarLease.getByRole('row').filter({ hasText: '2026-02-01' })).toContainText(
    '2026-02-15'
  );
  await expect(calendarLease.getByRole('row').filter({ hasText: '2028-02-01' })).toContainText(
    '2028-02-15'
  );
});

test('scenarios 5, 6, and 7 show a kind decline and manual-review decisions', async ({ page }) => {
  await page.goto('/en/quote/laptop-008?profile=cust-mikko&date=2026-11-08');
  await page.getByRole('button', { name: 'Continue to application' }).click();
  await page.getByRole('button', { name: 'Review simulated decision' }).click();
  await expect(page.getByRole('alert').first()).toContainText(/18|age/i);
  await expect(page.getByRole('button', { name: 'Confirm simulated signing' })).toHaveCount(0);

  await page.goto('/en/quote/ebike-004?profile=cust-norvi&date=2026-11-08');
  await page.getByRole('button', { name: 'Continue to application' }).click();
  const signerEmail = page
    .locator('label')
    .filter({ hasText: 'Email of the person who can sign' })
    .locator('input');
  await expect(signerEmail).toHaveCount(1);
  await signerEmail.fill('signer@example.com');
  await page.locator('form').last().locator('select').last().selectOption('commuting');
  await page.getByRole('button', { name: 'Review simulated decision' }).click();
  await expect(page.getByRole('alert').first()).toContainText(/review|check/i);

  await page.goto('/en/quote/farm-002?profile=cust-haapala&date=2026-11-08&term=48&down=2000000');
  await page.getByRole('button', { name: 'Continue to application' }).click();
  await page
    .locator('label')
    .filter({ hasText: 'Farm registry number' })
    .locator('input')
    .fill('FI-HAAPALA-02');
  const pepDetails = page
    .locator('label')
    .filter({ hasText: 'Which position, and since when?' })
    .locator('input');
  if (await pepDetails.count()) await pepDetails.fill('Municipal council, since 2022');
  await page.getByRole('button', { name: 'Review simulated decision' }).click();
  await expect(page.getByRole('alert').first()).toContainText(/review|check/i);
});

test('scenario 9 inspects, refurbishes, matches and simulates wait-list acceptance', async ({
  page,
}) => {
  await page.goto('/en/admin?profile=admin&date=2026-11-08&tab=returns#return-ebike-007');
  const item = page.locator('#return-ebike-007');
  await expect(item).toBeVisible();
  await item.getByLabel('Observed returned condition').selectOption('fair');
  await item.getByLabel('Observed usage counter').fill('18400');
  await item.getByRole('button', { name: 'Save inspection' }).click();
  await item.getByRole('button', { name: 'Recondition and match waiting list' }).click();
  await expect(item.getByText(/wait-02/)).toBeVisible();
  await expect(item.getByText(/wait-13/)).toBeVisible();
  await expect(item.getByText(/CO₂e/)).toBeVisible();
  await item.getByRole('button', { name: 'Accept matched offer and simulate signing' }).click();
  await expect(item.locator('p[role="status"]')).toContainText(
    'Simulated lease signed for: wait-02'
  );
});

test('scenario 10 releases an unmatched historic item for a third-life quote', async ({ page }) => {
  await page.goto('/en/admin?profile=admin&date=2027-04-16&tab=returns#return-ebike-008');
  const item = page.locator('#return-ebike-008');
  await expect(item).toBeVisible();
  await item.getByLabel('Observed returned condition').selectOption('good');
  await item.getByLabel('Observed usage counter').fill('9800');
  await item.getByRole('button', { name: 'Save inspection' }).click();
  await item.getByRole('button', { name: 'Recondition and match waiting list' }).click();
  await expect(item.getByText(/No current waiting-list request fits/)).toBeVisible();
  await expect(item.getByText(/CO₂e/)).toBeVisible();
  await page.goto('/en/catalogue?profile=cust-aino&date=2027-04-16');
  await expect(page.getByText('Estimated second-life net price').first()).toBeVisible();
  await page.locator('a[href^="/en/quote/ebike-008"]').click();
  await expect(page.getByRole('heading', { name: 'Configure your demo lease' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue to application' }).click();
  const usageQuestion = page.locator('form').last().locator('select').last();
  await usageQuestion.selectOption('commuting');
  await expect(usageQuestion).toHaveValue('commuting');
  await page.getByRole('button', { name: 'Review simulated decision' }).click();
  await page.getByRole('button', { name: 'Simulate a successful check' }).click();
  await page.getByRole('button', { name: 'Continue to simulated signing' }).click();
  await page.getByRole('button', { name: 'Confirm simulated signing' }).click();
  await expect(page).toHaveURL(/\/en\/account\?/);
  await expect(page.getByRole('heading', { name: 'Urban 1' }).first()).toBeVisible();
  await page.goto('/en/admin?profile=admin&date=2027-04-16&tab=passports');
  const passport = page.locator('#passport-ebike-008');
  await expect(passport).toBeVisible();
  await expect(passport.getByText(/CO₂e/).last()).toBeVisible();
  await expect(passport.getByText(/Aino Virtanen/)).toBeVisible();
  await page.goto('/en/account?profile=cust-aino&date=2028-04-16');
  const returnItem = page.getByRole('listitem').filter({ hasText: 'Urban 1' });
  await returnItem.getByLabel('Condition when returned').selectOption('fair');
  const usageInput = returnItem.getByLabel(/Usage counter when returned/);
  await usageInput.fill('10000');
  await returnItem.getByRole('button', { name: 'Simulate lease completion and return' }).click();
  await expect(returnItem.getByRole('status')).toContainText(
    'Lease completed on 2028-04-16; the item is awaiting admin inspection.'
  );
  await page.goto('/en/admin?profile=admin&date=2028-04-16&tab=returns');
  await expect(page.locator('#return-ebike-008')).toContainText('Lease completed');
  await expect(page.locator('#return-ebike-008')).toContainText('Customer reported at return');
  await expect(page.locator('#return-ebike-008')).toContainText('10,000');
});

test('simulate lease end starts the return without changing the date by hand', async ({ page }) => {
  await signLease(page, '/en/quote/ebike-002?profile=cust-aino&date=2026-11-05', '36');
  await expect(page).toHaveURL(/\/en\/account\?/);
  await page
    .getByRole('listitem')
    .filter({ hasText: 'Urban 2 Step-through' })
    .getByRole('button', { name: 'Simulate lease end' })
    .click();
  await expect(page).toHaveURL(/date=2029-11-05/);
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Urban 2 Step-through' }).getByRole('status')
  ).toContainText('Lease completed on 2029-11-05');
  await page.goto('/en/admin?profile=admin&date=2029-11-05&tab=returns');
  await expect(page.locator('#return-ebike-002')).toContainText('Lease completed');
});
