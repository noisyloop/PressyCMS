'use strict';
module.exports = (pressy) => {
  const wpm = Number(pressy.options.wordsPerMinute) || 225;
  pressy.addFilter('post', (doc) => {
    const minutes = Math.max(1, Math.round(doc.wordCount / wpm));
    return { ...doc, readingMinutes: minutes, readingTime: `${minutes} min read` };
  });
};
