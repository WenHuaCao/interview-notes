---
id: demo-event-loop
title: 一段代码里，Promise 和 setTimeout 谁先执行？
question: 请解释 JavaScript 事件循环中同步代码、Promise 回调和 setTimeout 的执行顺序，以及微任务检查点的作用。
source: chatgpt-work
createdAt: '2026-10-23T12:10:00.000Z'
answeredAt: '2026-10-23T12:11:00.000Z'
updatedAt: '2026-10-23T12:11:00.000Z'
tags: [javascript, browser]
demo: true
---

> 示例题，仅用于体验记录与复习功能。

先执行当前调用栈上的同步代码。在当前任务结束后，浏览器会执行微任务检查点，处理队列中的微任务；之后才有机会执行下一个任务。

```javascript
console.log('A');
setTimeout(() => console.log('B'), 0);
Promise.resolve().then(() => console.log('C'));
console.log('D');
// A → D → C → B
```

这里的 `Promise.then` 回调进入微任务队列，定时器回调则要等待之后的任务调度。`0` 毫秒不表示立即执行。

## 别只背一句“微任务优先”

- 当前同步代码必须先执行完。
- 微任务检查点会持续处理队列，包括执行微任务时新加入的微任务。
- 不断追加微任务可能推迟渲染和其他任务。
- Node.js 的宿主调度机制还包含其他队列和阶段，不能把浏览器的例子机械套过去。
