// ============================================================================
// Court Access — Logic Forms Reference Data
// Used by explainable argument engine for structured legal reasoning.
// ============================================================================

export interface LogicForm {
  id: string;
  name: string;
  formula: string;
  description: string;
}

export const LOGIC_FORMS: LogicForm[] = [
  {
    id: 'modus_ponens',
    name: 'Modus Ponens',
    formula: 'P → Q, P ⟹ Q',
    description: 'If P implies Q and P is true, then Q is true.',
  },
  {
    id: 'modus_tollens',
    name: 'Modus Tollens',
    formula: 'P → Q, ¬Q ⟹ ¬P',
    description: 'If P implies Q and Q is false, then P is false.',
  },
  {
    id: 'hypothetical_syllogism',
    name: 'Hypothetical Syllogism',
    formula: 'P → Q, Q → R ⟹ P → R',
    description: 'Chain of implications.',
  },
];
