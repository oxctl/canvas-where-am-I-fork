const axios = require('axios');
const assert = require('assert');
const dotenv = require('dotenv');

dotenv.config();
jest.setTimeout(1200000);

// Contains the created course, reusable between tests.
let courseObject = {};

// Configuration parameters, see .env.example for more information.
const token = process.env.OAUTH_TOKEN;
const host = process.env.CANVAS_HOST;
const account = process.env.ACCOUNT_ID;

getRandomModule = () => {
  return moduleArray[Math.floor(Math.random() * moduleArray.length)];
}

goToCourse = async (page) => {
  await page.goto(`${host}/courses/${courseObject.id}`);
}

appendCPNScript = async (page) => {
  await page.evaluate(() => ENV['FORCE_CPN'] = true);
  await Promise.all([
    page.addScriptTag({ path: './canvas-where-am-I.js' }),
    page.addStyleTag({ path: './canvas-where-am-I.css' }),
  ]);
}

describe('Test the CPN script logic with an empty course.', () => {

  beforeAll(async () => {
    assert(token, 'You must set the environmental variable OAUTH_TOKEN');
    assert(host, 'You must set the environmental variable CANVAS_HOST');
    assert(account, 'You must set the environmental variable ACCOUNT_ID');

    // Creates an empty course in the instance to check the navigation.
    const course = { course: { name: 'IGNORE: CPN EMPTY TESTING', course_code: 'ignore_cpn_empty_testing', default_view: 'modules' } };
    await axios({
      method: 'POST',
      url: `${host}/api/v1/accounts/${account}/courses`,
      headers: {'Authorization': 'Bearer ' + token},
      data: course
    }).then((response) => {
      courseObject = response.data;
      console.log('course created');
    }).catch(err => {
      console.log('error creating course: ', err);
      throw err;
    });

  });

  afterAll(async () => {
    // Delete the course
    await axios({
      method: 'DELETE',
      url: `${host}/api/v1/courses/${courseObject.id}`,
      headers: {'Authorization': 'Bearer ' + token},
      data: { event: 'delete' }
    })
  });

  beforeEach(async () => {
    // We should always have more than 60 seconds as we sometimes see a 60 second stall.
    await page.setDefaultTimeout(90000);
    await Promise.all([
      page.waitForNavigation(),
      axios.get(`${host}/login/session_token`, {headers: {'Authorization': 'Bearer ' + token}})
      .then((response) => {
        return page.goto(response.data.session_url);
      })
    ]);
  });

  it('General: Check the course is created and navigable.', async () => {
    await goToCourse(page);
    await expect(page.title()).resolves.toMatch(courseObject.name);
  });

  it('Tile View: Check content DIV exists.', async () => {
    await goToCourse(page);
    const element = await page.$('#content');
    await expect(element).not.toBeNull();
  });

  it('Tile View: Check the script does not make any changes in the home page.', async () => {
    await goToCourse(page);
    await appendCPNScript(page);
    // Check the message that there are no courses
    const noModulesMessage = await page.$('#no_context_modules_message');
    await expect(noModulesMessage).not.toBeNull();
    // Check the course_home_content div is not removed
    const divHomeContent = await page.$('#course_home_content');
    await expect(divHomeContent).not.toBeNull();
    // Check the module_nav div does not exist
    const moduleNav = await page.$('#module_nav');
    await expect(moduleNav).toBeNull();
    // Check the ability to add modules
    const addModuleLink = await page.$('.add_module_link');
    await expect(addModuleLink).not.toBeNull();
  });

  it('Tile View: Ensure the script does not perform any action in other course homes.', async () => {
    // Replaces the course home by the feed instead of modules.
    await axios({
      method: 'PUT',
      url: `${host}/api/v1/courses/${courseObject.id}`,
      headers: {'Authorization': 'Bearer ' + token},
      data: 'course[default_view]=feed'
    });

    await goToCourse(page);
    await appendCPNScript(page);
    // Check the home page is feed and not modules
    const noModulesMessage = await page.$('#no_context_modules_message');
    await expect(noModulesMessage).toBeNull();
    const recentActivityElement = await page.$('.recent_activity');
    await expect(recentActivityElement).not.toBeNull();
    // Check the course_home_content div is not removed
    const divHomeContent = await page.$('#course_home_content');
    await expect(divHomeContent).not.toBeNull();
    // Check the module_nav div does not exist
    const moduleNav = await page.$('#module_nav');
    await expect(moduleNav).toBeNull();
  });

  it('Modules submenu: Check the script does not make any changes in LHS menu.', async () => {
    await goToCourse(page);
    await appendCPNScript(page);
    const modulesToolLink = await page.$$('li.section a.modules');
    await expect(modulesToolLink).not.toBeNull();
    const submenuElement = await page.$('.ou-section-tabs-sub');
    await expect(submenuElement).toBeNull();
  });

});
