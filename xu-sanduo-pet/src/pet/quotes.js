'use strict';

const { STATES } = require('./state-machine');

const QUOTES = {
  [STATES.IDLE]: ['稍息。', '等待任务。', '……'],
  [STATES.CODING]: [
    '任务进行中。',
    '不抛弃，不放弃。',
    '一颗一颗抠。',
    '站岗写码。',
  ],
  [STATES.MONKEY_BAR]: [
    '再想想……',
    '绕开思路！',
    '单杠磨的是心。',
    '卡住了也不放下。',
  ],
  [STATES.RUNNING]: [
    '该活动活动了！',
    '五公里，出发！',
    '身体是革命的本钱。',
  ],
  [STATES.SLEEPING]: ['……呼噜', '休整中。', '养精蓄锐。'],
  [STATES.CELEBRATE]: [
    '不抛弃！不放弃！',
    '报告！任务完成！',
    '胜利属于坚持的人！',
  ],
  [STATES.GREET]: ['报告！三多归队！', '班长好！', '准备就绪！'],
  [STATES.DEBUG]: ['有情况！', '排查中……', '找到它。'],
};

function pickQuote(state) {
  const list = QUOTES[state] || QUOTES[STATES.IDLE];
  return list[Math.floor(Math.random() * list.length)];
}

module.exports = { QUOTES, pickQuote };
