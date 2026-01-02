const lessons = [
  {
    id: 1,
    title: 'Introduction to Grammar',
    content:
      'In this lesson, we will explore the basics of grammar, including parts of speech, sentence structure, and punctuation.',
    objectives: [
      'Understand the different parts of speech.',
      'Identify sentence structures.',
      'Use punctuation correctly.',
    ],
    activities: [
      {
        type: 'quiz',
        questions: [
          {
            question: 'What is a noun?',
            options: ['A person, place, or thing', 'An action word', 'A describing word'],
            answer: 'A person, place, or thing',
          },
          {
            question: 'Which of the following is a verb?',
            options: ['Run', 'Beautiful', 'Quickly'],
            answer: 'Run',
          },
        ],
      },
      {
        type: 'writing',
        prompt: 'Write a short paragraph using at least three different parts of speech.',
      },
    ],
  },
  {
    id: 2,
    title: 'Exploring Literature',
    content:
      'This lesson focuses on understanding different genres of literature, including fiction, non-fiction, poetry, and drama.',
    objectives: [
      'Identify different genres of literature.',
      'Analyze the elements of a story.',
      'Discuss themes and messages in literature.',
    ],
    activities: [
      {
        type: 'discussion',
        prompt: 'What is your favorite genre of literature and why?',
      },
      {
        type: 'reading',
        material: 'Read a short story and identify its genre, themes, and main characters.',
      },
    ],
  },
];

export default lessons;
