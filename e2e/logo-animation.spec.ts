import { expect, test } from '@playwright/test';

test('home logo plays once and header logo plays on hover and focus', async ({ page }) => {
  await page.goto('/en');
  const headerLink = page.locator('header a').filter({ has: page.locator('svg') });
  const headerMark = headerLink.locator('svg');
  const heroMark = page.locator('#main section').first().locator('svg');

  await expect(heroMark.locator('g').first()).toHaveCSS('animation-duration', '2.4s');
  await expect(headerMark.locator('g').first()).toHaveCSS('animation-name', 'none');

  await headerLink.hover();
  for (const mark of [headerMark, heroMark]) {
    const result = await mark.evaluate((svg) => {
      const [circle, arrow] = Array.from(svg.querySelectorAll('g'));
      if (!circle || !arrow) throw new Error('Logo parts missing');
      const circleAnimation = circle.getAnimations()[0];
      const arrowAnimation = arrow.getAnimations()[0];
      if (!circleAnimation || !arrowAnimation) throw new Error('Logo animation missing');
      circleAnimation.pause();
      arrowAnimation.pause();

      const sample = (time: number) => {
        circleAnimation.currentTime = time;
        arrowAnimation.currentTime = time;
        return {
          circle: new DOMMatrix(getComputedStyle(circle).transform).a,
          arrow: new DOMMatrix(getComputedStyle(arrow).transform).m42,
          opacity: Number(getComputedStyle(arrow).opacity),
        };
      };
      return {
        early: sample(400),
        middle: sample(1500),
        end: sample(2400),
        iterations: circleAnimation.effect?.getTiming().iterations,
      };
    });
    expect(result.early.arrow).toBeLessThan(0);
    expect(result.middle.opacity).toBe(0);
    expect(result.middle.circle).toBeLessThan(0);
    expect(result.end.circle).toBeCloseTo(-1);
    expect(result.end.arrow).toBeCloseTo(0);
    expect(result.end.opacity).toBe(1);
    expect(result.iterations).toBe(1);
  }

  await page.mouse.move(0, 0);
  await expect(headerMark.locator('g').first()).toHaveCSS('animation-name', 'none');
  await headerLink.focus();
  await expect(headerMark.locator('g').first()).not.toHaveCSS('animation-name', 'none');
});

test('reduced motion leaves both marks still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en');
  await page
    .locator('header a')
    .filter({ has: page.locator('svg') })
    .hover();
  for (const group of await page.locator('header svg g, #main section:first-child svg g').all()) {
    await expect(group).toHaveCSS('animation-name', 'none');
    await expect(group).toHaveCSS('opacity', '1');
  }
});
