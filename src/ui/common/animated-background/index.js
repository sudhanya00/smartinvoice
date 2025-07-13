// --- Animated Background ---
export default () => (
  <div className="fixed top-0 left-0 w-full h-full -z-10 overflow-hidden">
    <div className="absolute top-0 left-0 w-full h-full bg-gray-100" />
    <div className="absolute w-[1000px] h-[1000px] bg-gradient-to-br from-white via-gray-200 to-gray-300 rounded-full animate-pulse-slow -top-1/2 -left-1/2" />
    <div className="absolute w-[800px] h-[800px] bg-gradient-to-tl from-white via-gray-200 to-gray-300 rounded-full animate-pulse-slow-reverse -bottom-1/2 -right-1/2" />
  </div>
);