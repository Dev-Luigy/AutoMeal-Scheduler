import { FastifyReply, FastifyRequest } from 'fastify';
import { app } from './app';
import { z } from 'zod';
import puppeteer, { Page } from 'puppeteer';
import { addDays, compareAsc, format, isWeekend } from 'date-fns';

app.get('/example', async function (request: FastifyRequest, reply: FastifyReply) {
  const zodSchema = z.object({
    login: z.string(),
    senha: z.string()
  });

  const data = zodSchema.parse(request.query);

  function delay(time: number) {
    return new Promise(resolve => setTimeout(resolve, time));
  }

  async function addCadForDay(page: Page, date: Date, mealType: 'lunch' | 'dinner') {
    await delay(1000);

    console.log(date, new Date())
    // Set date
    const inputDate = await page.$('#formulario\\:data_agendamento');
    if (inputDate) {
      await inputDate.click(); // Focus the input field
      await page.keyboard.down('ControlLeft');
      await page.keyboard.press('a');
      await page.keyboard.up('ControlLeft');
      await page.keyboard.press('Delete');
      await delay(1000);
      await inputDate.type(format(date, 'dd/MM/yyyy')); // Ensure correct format
    }

    // Set meal type
    const inputType = await page.$('#formulario\\:tipo_refeicao');
    if (inputType) {
      await inputType.click();
      if (mealType === 'lunch' && date.getDate() === new Date().getDate()) {
        await page.keyboard.press('ArrowDown'); // Select the lunch option
        await delay(1000);
      } else if (mealType === 'dinner' && date.getDate() === new Date().getDate()) {
        await page.keyboard.press('ArrowDown'); // Select the dinner option
        await delay(1000);
      }
      await page.keyboard.press('Enter');
    }


    // Submit form
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowDown');

    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
  }

  function getNextWeekday(date: Date): Date {
    let newDate = date;
    while (isWeekend(newDate)) {
      newDate = addDays(newDate, 1);
    }
    return newDate;
  }

  try {
    const baseDate = new Date(); // Use the current date as the starting date

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--enable-logging',
        '--disable-infobars',
        '--excludeSwitches',
        '--useAutomationExtension',
        '--enable-automation',
        '--disable-gpu',
        '--disable-extension',
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--window-position=0,0',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list',
        '--no-default-browser-check',
        '--password-manager-enabled=false',
        '--user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/65.0.3312.0 Safari/537.36"',
        '--window-size=1200,880'
      ],
      ignoreDefaultArgs: ["--enable-automation"],
      userDataDir: "./user_data",
      defaultViewport: null,
      slowMo: 10
    });

    const page = await browser.newPage();
    await page.goto('https://si3.ufc.br/sigaa/');

    // Fill the login field
    await page.waitForSelector("#conteudo > table > tbody > tr > td > div > form > table > tbody > tr:nth-child(1) > td > input[type=text]");
    await page.$eval("#conteudo > table > tbody > tr > td > div > form > table > tbody > tr:nth-child(1) > td > input[type=text]", (e, value) => e.value = value, data.login);
    await page.$eval('#conteudo > table > tbody > tr > td > div > form > table > tbody > tr:nth-child(2) > td > input[type=password]', (e, value) => e.value = value, data.senha);

    // Click submit button
    await page.click('input[type="submit"]');

    // Wait for the next page to load
    await page.waitForSelector("#j_id_jsp_1809757351_1 > div > input[type=submit]");
    await page.click('input[type="submit"]');

    await page.waitForSelector("#portais > ul > li.discente.on > a");
    await page.click('#portais > ul > li.discente.on > a');

    await page.waitForSelector("#cmAction-97 > td.ThemeOfficeMenuItemText");
    await page.click('#cmAction-96 > span.ThemeOfficeMainFolderText');
    await page.click('#cmAction-97 > td.ThemeOfficeMenuItemText');

    await page.waitForSelector('#conteudo > section > h3');

    // Ensure the element is present and interactable
    await page.waitForSelector('#formulario\\:data_agendamento');

    let daysAdded = 0;
    let currentDate = baseDate;

    // Arrays to keep track of marked days
    const markedDays: string[] = [];

    // Add 3 days of lunch entries
    while (daysAdded < 3) {
      currentDate = getNextWeekday(currentDate); // Skip weekends
      console.log(`Adding lunch for ${currentDate}`);
      await addCadForDay(page, currentDate, 'lunch');
      currentDate = addDays(currentDate, 1); // Move to the next day
      daysAdded++;
    }

    // Reset for dinner entries
    daysAdded = 0;
    currentDate = baseDate;

    // Add 3 days of dinner entries
    while (daysAdded < 3) {
      currentDate = getNextWeekday(currentDate); // Skip weekends
      console.log(`Adding dinner for ${currentDate}`);
      await addCadForDay(page, currentDate, 'dinner');
      currentDate = addDays(currentDate, 1); // Move to the next day
      daysAdded++;
    }

    // Take screenshot of the marked days

    // Send response with marked days and screenshot
    reply.header('Content-Type', 'application/json');
    reply.send({
      message: 'Days marked successfully',
      markedDays,
    });

    await browser.close();
  } catch (error) {
    console.error('An error occurred:', error);
    reply.status(500).send({ error: 'An error occurred during Puppeteer operations' });
  }
});

app.listen({
  host: '0.0.0.0',
  port: 3002,
})
  .then(() => {
    console.log('Server running on port 3002');
  })
  .catch(err => {
    console.error('Error starting server:', err);
  });
