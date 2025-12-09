// 简单菜单交互
const { writeInfo, writeWarn, writeError, readLine, clearScreen } = require('./utils');

async function selectFromList(items, formatFn, title) {
  if (!items || items.length === 0) {
    return { kind: 'Empty', value: -1 };
  }
  
  console.log(`\n${title}:`);
  items.forEach((item, i) => {
    const text = formatFn(item);
    console.log(`  ${i + 1}. ${text}`);
  });
  console.log(`  0. 返回/退出`);
  console.log('');
  
  const input = await readLine(`输入数字 (0-${items.length}): `);
  const index = parseInt(input, 10);
  
  if (isNaN(index) || index < 0 || index > items.length) {
    writeWarn('无效输入');
    return { kind: 'Invalid', value: -1 };
  }
  
  if (index === 0) {
    return { kind: 'Back', value: -1 };
  }
  
  return { kind: 'Index', value: index - 1 };
}

async function selectAction(actions, title) {
  console.log(`\n${title}:`);
  actions.forEach((action, i) => {
    console.log(`  ${i + 1}. ${action.label}`);
  });
  console.log('');
  
  const input = await readLine(`输入数字 (1-${actions.length}): `);
  const index = parseInt(input, 10);
  
  if (isNaN(index) || index < 1 || index > actions.length) {
    writeWarn('无效输入');
    return null;
  }
  
  return actions[index - 1].code;
}

module.exports = {
  selectFromList,
  selectAction,
};
