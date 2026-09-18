/** Fixed-size decorative corner overlays for the repeating-edge frame system. */
export default function OrnateCorners() {
  return <span className="ornate-corners" aria-hidden="true">
    <i className="ornate-corner corner-tl" />
    <i className="ornate-corner corner-tr" />
    <i className="ornate-corner corner-bl" />
    <i className="ornate-corner corner-br" />
  </span>;
}
