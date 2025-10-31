import { Cpu, Server, Network, Cloud , Workflow, Backpack, ConciergeBell, Code2, Rocket, Blocks, List } from "lucide-react";

const questions = [
  {
    id: 1,
    text: "How can I deploy my AI model efficiently?",
    topic: "AI & Tech",
    Icon: <Cpu size={30} />,
  },
  {
    id: 2,
    text: "What’s the difference between TCP and UDP?",
    topic: "Networking",
    Icon: <Network size={30} />,
  },
  {
    id: 3,
    text: "Which Python library is best for beginner data analysis?",
    topic: "Programming",
    Icon: <Code2 size={30} />,
  },
  {
    id: 4,
    text: "How can I automate repetitive tasks in my workflow?",
    topic: "Automation",
    Icon: <Workflow size={30} />,
  },
  {
    id: 5,
    text: "How do I use Cloudflare tunnel with n8n self-hosted?",
    topic: "Cloud & Security",
    Icon: <Cloud size={30} />,
  },
  {
    id: 6,
    text: "What’s the easiest way to make chocolate chip cookies?",
    topic: "Cooking",
    Icon: <ConciergeBell size={30} />,
  },
  {
    id: 7,
    text: "How do I plan a 3-day trip to Paris on a budget?",
    topic: "Travel",
    Icon: <Backpack size={30} />,
  },
  {
    id: 8,
    text: "How can I deploy an ML model on my local server?",
    topic: "AI & ML",
    Icon: <Server size={30} />,
  }
];

const deployerQuestions = [
  { 
    id: 1, 
    topic: "Deploy Model", 
    text: "Deploy a model to Nosana Jobs on nvdia 3060 , model Name : mistral-7b",
    Icon: <Rocket size={30} />
  },
  { 
    id: 2, 
    topic: "Manage Jobs", 
    text: "Show me all active and prev Jobs on Nosana",
    Icon: <Blocks size={30} />
  },
  { 
    id: 3, 
    topic: "List MCP Tools", 
    text: "Show me all available mcp tools for Nosana deployments",
    Icon: <List size={30} />
  }
];

export { questions , deployerQuestions };