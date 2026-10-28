---
id: demo-closure
title: 闭包为什么能记住函数外部的变量？
question: 什么是 JavaScript 闭包？为什么外部函数执行结束后，内部函数仍然能访问它的变量？请结合实际场景解释。
source: codex
createdAt: '2026-10-26T02:30:00.000Z'
answeredAt: '2026-10-26T02:31:00.000Z'
updatedAt: '2026-10-26T02:31:00.000Z'
tags: [javascript]
demo: true
---

> 这是一道用于体验网站的示例题，不是你的真实提问记录。

闭包是函数与它创建时能够访问的词法环境的组合。函数被传到别处调用时，依然能访问定义位置的变量。

## 用一个计数器理解

```javascript
function createCounter() {
  let count = 0;
  return function increment() {
    count += 1;
    return count;
  };
}

const next = createCounter();
next(); // 1
next(); // 2
```

`createCounter()` 调用结束，并不意味着其中所有变量都必须销毁。只要返回的函数仍可达，它引用的词法环境就仍有用途。

## 面试时可以这样解释

1. JavaScript 使用词法作用域，函数可访问哪些变量取决于定义位置。
2. 内部函数被返回或传递后，可以继续持有外层环境。
3. 每次调用外层函数都会创建新的环境，因此不同计数器之间互不影响。

实际应用包括封装私有状态、函数工厂和回调。需要注意：长时间保留的闭包可能使其引用的对象一直无法回收。

## 留给自己的追问

为什么用 `var` 写循环时，多个回调往往读到同一个最终值，而 `let` 可以表现不同？
