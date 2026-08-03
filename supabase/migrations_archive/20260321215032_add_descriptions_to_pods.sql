/*
  # Add Descriptions to Pods

  1. Purpose
    - Add helpful descriptions to existing pods to explain their purpose
    - Help users understand what each strategic question is about

  2. Changes
    - Update pod descriptions with 1-2 sentence explanations
*/

-- Update pod descriptions
UPDATE pods SET description = 'Explore strategic decisions, challenge assumptions, and forecast outcomes through collaborative analysis. Join to contribute your insights and perspectives.' WHERE name = 'General Strategy';

UPDATE pods SET description = 'Analyze product development strategies, market fit assumptions, and launch plans. Collaborate on building better products through shared insights.' WHERE name = 'Product Strategy';

UPDATE pods SET description = 'Examine market trends, competitive dynamics, and business model innovations. Make sense of complex market forces together.' WHERE name = 'Market Analysis';

UPDATE pods SET description = 'Question assumptions, stress test hypotheses, and build robust strategic frameworks. Challenge conventional thinking with evidence and reasoning.' WHERE name = 'Critical Thinking';

UPDATE pods SET description = 'Assess technology trends, implementation risks, and innovation opportunities. Navigate technical decisions with collective intelligence.' WHERE name = 'Technology Decisions';

UPDATE pods SET description = 'Evaluate investment opportunities, financial risks, and growth strategies. Pool expertise to make informed financial decisions.' WHERE name = 'Investment Analysis';