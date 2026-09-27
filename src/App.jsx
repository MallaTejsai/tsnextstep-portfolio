import Backdrop from "./components/Backdrop";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import About from "./components/About";
import Work from "./components/Work";
import Alli from "./components/Alli";
import Journey from "./components/Journey";
import Skills from "./components/Skills";
import Content from "./components/Content";
import Contact from "./components/Contact";
import Footer from "./components/Footer";

export default function App() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <Backdrop />
      <Navbar />

      <main id="main">
        <Hero />
        <About />
        <Work />
        <Alli />
        <Journey />
        <Skills />
        <Content />
        <Contact />
      </main>

      <Footer />
    </>
  );
}
