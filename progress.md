
Created the /ask response route for testing SSE functionality in the frontend and verifying correct parsing.
Addressed frontend issues, including response parsing and Markdown implementation.
Developed a workflow package to establish a workflow pipeline for the /ask route; implementation is planned to enhance code structure and performance.

15-9-25 ~
Worked on handleModelMode implementation.
Added features: search, thinking, and tool context integration.
Need to:
- Separate codebase for better readability.
- Fix bugs occurring during responses.

16-9-25 ~
Worked on type improvement
Initialized Node.js server 
Worked on structured route draft 
Worked on handleModelMode
Improved prompt, fixed search related bugs
Worked on UI - setting popup, custom prompt etc.

17-9-25 ~ half 1
Worked on orchestrating the code files (centralized files for different tasks and streaming etc.)
Added other routes like zero etc.
worked on implementing the @ai/sdk for fast response
tried fixing logic for faster response and to save tokens

17-9-25 ~ half 2
integrated @ai-sdk to replace other sdk for faster response
worked on prompt and prompt parser for quick and cost effective ai result
worked on context cutting to save up the tokens with max relevant stuffs to be delivered

18-9-25 ~
- Implemented self-hosted model integration, now handling OpenAI-compatible models efficiently (planning to migrate to the Vercel AI SDK).
- Refined the build process and fixed all bugs; the app is now ready for deployment on Vercel and other platforms.
- Improved performance and addressed additional tasks, including prompt engineering and minor fixes.

19-9-25 ~ half 1
- fixed frontend , fixed hosting related bug
- improved error handling , added abort streaming option 
- adding credit deduction (working on it)
- Fixed Linting issues

19/24-09-25
- solved multiple small small bugs and added features 

25-09-25
- fixed abort bug
- fixed reasoning and minor ui's for mobile device
- added ai sdk for gemini

26-09-25
- Added UI and backend logic for custom model configuration.
- Cleaned up code and UI, keeping logic mainly for self-hosted models.
- Added feature to export threads and individual chats.
- Import threads feature in progress.

27-09-25
- added search chat and command functionality
- added more model 
- tried benchmark on model speed over plain fetch and other sdk's 

28-09-25
- updated full chatapp ui 
- updated the markdown ui
- other requested improvements

29-09-25
- Refined frontend and resolved hosting issue
- Fixed Settings popup and Search popup UI issues on phone screens
- Continued exploration of n8n
- Implemented thread import feature (supports single and multiple imports)

30-09-25
- Fixed continuous hosting-related bug caused by packages.
- Adjusted UI and layout across the entire project.
- Added additional command functionality in chat search.
- Integrated response time tracking for chat.

1-10-25
- added code installation option 
- added suggestion prompt ui , in frontend
- tried centralizing self model
- added follow up question feature

2-10-25
Added additional settings in the frontend allowing users to choose:
  - Whether he wants AI follow-ups
  - Whether to display errors messages or not
Enhanced prompt and follow-up feature
tried Fixing rendering issues on phone screens || add success ui on chats 
Added reasoning scroll ref and improved scrolling behavior

3-10-25
Added theme toggler and added both dark and light mode 
try adding more feature like rename (pin , share on hold) threads
improved gemini error handling
fixed default theme and other minor ui issues issue

4-10-25
- worked on gemini error handling , custom config , prompt , and other enhancments
- added user api intergration in frontend with ping varification , (utilized that api in backend)
- added prompt template
- fixed backend payload conflict (between zod and payload type) ts error
- researched about pro search integration
- improved mobile compatibility and ui 
- fixed setting option rendering issue

6-10-25
- Refactored handlers for better type safety and readability
  - Streamlined types and reduced multiple parameter dependencies
  - Added settings hooks for easier configuration
- Introduced custom context and context-based settings
- Enhanced validation with Zod, including improved error handling in frontend
- added dynamic prompting based on keywords
- Overall codebase refactor focusing on type improvements

7-10-25
- remove unnecessary features based on requirement

8-10-25
- fix the mobile viewport alignment issue on phone

9/10-10-25
- Improved UI to better match Figma designs.
- Updated codebase naming conventions from Inferia to Nasona.
- Applied minor color and style upgrades across various components.

11-10-25
- chatmessage ui improvement
- reasoning , url section modified 

13-10-25
- refactor(chat): segregated main chat form UI and logic into modular components
- upgrade sidebar UI
- improved and segregated settingPopOver UI | and sideBar
- enchanced searchbar popup ui

14-10-25
- ask page alignment update + minor ui enhancements (copy button etc.)

15/16-10-25
- frontend UI and logic change for deployer tool(mcp) feature
- worked on auth part of mcp , create token and user id , pass it to tools
- created separate workshop for mcp 
- Integrated wallet and implemented wallet store
- worked on tooling integration with ai sdk
- Updated Nosana job tools

