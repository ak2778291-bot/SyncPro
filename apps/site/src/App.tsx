import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { Problem } from "./components/Problem";
import { Vision } from "./components/Vision";
import { WhoItsFor } from "./components/WhoItsFor";
import { Sectors } from "./components/Sectors";
import { Waitlist } from "./components/Waitlist";
import { Footer } from "./components/Footer";

export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Problem />
        <Vision />
        <WhoItsFor />
        <Sectors />
        <Waitlist />
      </main>
      <Footer />
    </>
  );
}
