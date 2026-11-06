import type { WebDriver, WebElement } from 'selenium-webdriver';

export async function showBanner(driver: WebDriver, step: number, title: string, action: string): Promise<void> {
  await driver.executeScript((step: number, title: string, action: string) => {
    let banner = document.getElementById('swt-test-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'swt-test-banner';
      Object.assign(banner.style, {
        position: 'fixed', top: '0', left: '0', right: '0', zIndex: '9999999',
        background: '#0f172a', color: 'white', padding: '12px 24px',
        font: '15px system-ui, sans-serif', borderBottom: '3px solid #38bdf8',
      });
      document.body.appendChild(banner);
    }
    banner.textContent = `Schritt ${step} · ${title} · ${action}`;
  }, step, title, action);
}

export async function highlightLink(driver: WebDriver, link: WebElement): Promise<void> {
  await driver.executeScript((element: HTMLElement) => {
    Object.assign(element.style, {
      outline: '4px solid #f43f5e', backgroundColor: '#fef08a', color: 'black', fontWeight: 'bold',
    });
    element.scrollIntoView({ block: 'center' });
  }, link);
}
