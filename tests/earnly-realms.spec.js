const {test, expect} = require('@playwright/test');

test('a realm retains edited surfaces and positioned objects after a reload', async ({page}) => {
  await page.goto('/earnly-realms.html');
  await page.getByRole('button', {name:/Enter My Realm/}).click();
  const press = name => page.getByRole('button', {name,exact:true}).click();
  await press('Surfaces'); await press('floor'); await press('Lava');
  await press('Objects'); await press('Portal');
  await page.getByLabel('Across').fill('1.2');
  await press('World'); await press('Undo'); await press('Redo');
  await press('Save');
  await page.getByLabel('Realm name').fill('Abyss observatory');
  await press('Save world');
  await page.reload();
  await press('My Saved Worlds'); await press('Abyss observatory');
  await press('Surfaces'); await press('floor');
  await expect(page.getByRole('button',{name:'Lava',exact:true})).toHaveClass('active');
  await press('Arrange');
  const objects = page.getByLabel('Selected object');
  await objects.selectOption({label:'Portal 4'});
  await expect(page.getByLabel('Across')).toHaveValue('1.2');
});
