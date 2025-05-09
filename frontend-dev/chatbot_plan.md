# Planet Beauty Chatbot Design Plan
## Objective
Create a responsive, visually stunning chatbot interface for [planetbeauty.com](https://www.planetbeauty.com/) using Tailwind CSS, positioned in the lower-right corner, with a modern chatbox, distinct user and AI message designs, an enhanced product card with "Shop Now", "Add to Cart", and "Reason for Match" sections, a sleek header, and a "Bella thinking" animation. The chatbot should adapt to the sitewide theme by default but currently emulate Planet Beauty’s aesthetic (clean, elegant, modern, with a beauty-focused vibe).
## Key Features

Chatbox Design:
Fixed in the lower-right corner, collapsible to a circular button when inactive.
Matches Planet Beauty’s color scheme (white #FFFFFF, soft pink #F9E8E8, gold #D4A373, gray #E5E7EB, black #000000).
Responsive: Full-width on mobile, fixed 400px wide/600px tall on desktop.


User and AI Messages:
User: Right-aligned, soft pink background (#F9E8E8).
AI: Left-aligned, light gray background (#E5E7EB), with Bella’s avatar.
Chat bubbles with shadows, rounded corners, and fade-in animations.


"Bella Thinking" Indicator:
Three bouncing dots in pink (#F9E8E8) when Bella is processing.
Smooth, lightweight animation.


Product Card:
Displays product image, name, price, "Reason for Match" (below price), "Shop Now" (black #000000), and "Add to Cart" (soft pink #F9E8E8) buttons.
"Reason for Match": Concise text (1–2 sentences) in gray (#E5E7EB) explaining why the product is recommended.
Responsive: Buttons stack vertically on mobile, reason text scales to text-xs.
Hover effects for interactivity.


Header:
Fixed at the top with Bella’s name/logo and close/minimize button.
Styled with soft pink background (#F9E8E8) and bold typography.


Responsiveness:
Mobile: Full-screen chatbox with adjusted font sizes and stacked buttons.
Desktop: Fixed-size chatbox with smooth transitions.
Uses Tailwind’s responsive utilities and media queries.


Accessibility:
ARIA attributes (aria-label, aria-live) for screen readers.
High-contrast text and keyboard navigation.



## Design Inspiration

Colors: White #FFFFFF, soft pink #F9E8E8, gold #D4A373, gray #E5E7EB, black #000000.
Typography: Montserrat, sans-serif, for elegance.
Style: Clean, minimal, luxurious with gold accents and smooth transitions.

## Success Criteria

Feels like an extension of [planetbeauty.com](https://www.planetbeauty.com/).
Intuitive, visually stunning, and accessible with clear product recommendations.
Sets a new standard for chatbot interfaces.


## To-Do List

Setup and Configuration:

 Initialize HTML with Tailwind CSS CDN.
 Configure Tailwind with Planet Beauty’s colors and fonts.
 Create JavaScript for chatbox toggling and message handling.


Chatbox Implementation:

 Design fixed-position chatbox in lower-right corner.
 Create circular toggle button that expands to rectangular window.
 Style with Planet Beauty’s colors and shadows.
 Ensure responsiveness (full-width on mobile, fixed on desktop).


Header Design:

 Add header with Bella’s name/logo and close button.
 Style with soft pink background and bold typography.
 Keep header fixed when scrolling.


User and AI Messages:

 Style user messages (right-aligned, soft pink).
 Style AI messages (left-aligned, light gray, with avatar).
 Add fade-in animations.


"Bella Thinking" Indicator:

 Implement three-dot typing animation in pink.
 Ensure smooth animation.


Product Card:

 Design card with image, name, price, "Reason for Match", "Shop Now" (black), and "Add to Cart" (soft pink) buttons.
 Add "Reason for Match" section below price with concise text in gray.
 Integrate into AI messages.
 Add hover effects and ensure responsiveness (stacked buttons on mobile, scaled reason text).
 Dynamically generate reason text based on user input or product attributes.


Responsiveness and Accessibility:

 Use Tailwind’s responsive utilities for mobile, tablet, desktop.
 Add media queries for mobile full-width chatbox and stacked buttons.
 Implement ARIA attributes and keyboard navigation.
 Test contrast ratios.


Testing and Polish:

 Test on multiple devices and browsers.
 Optimize animations and load times.
 Validate reason text readability and relevance.
 Refine based on user feedback.




## Needed Resources

Tailwind CSS:

CDN: https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css
Optional: Local Tailwind setup for custom config.


Fonts:

Montserrat: https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&amp;display=swap


Assets:

Bella’s avatar (32x32px placeholder: https://via.placeholder.com/32).
Product images (100x100px placeholder: https://via.placeholder.com/100).


Tools:

Code editor (e.g., VS Code).
Browser for testing (Chrome, Firefox, Safari).
Optional: Tailwind CLI.


Dependencies:

None (uses CDN and vanilla JavaScript).




## Next Steps

Integration: Connect to a backend or AI service (e.g., xAI’s API) to generate dynamic reason text.
Theming: Implement dynamic theme detection for sitewide theme.
Testing: Conduct A/B testing and usability tests, focusing on reason text clarity.
Enhancements: Add quick replies, voice input, or multilingual support.

