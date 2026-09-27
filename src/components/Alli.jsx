import AlliCore from "./AlliCore";
import AlliRoadmap from "./AlliRoadmap";

export default function Alli() {
  return (
    <section
      className="section section-alt alli-section"
      id="alli"
      aria-labelledby="alli-core-title"
    >
      <div className="container">
        <AlliCore />
        <AlliRoadmap />
      </div>
    </section>
  );
}
