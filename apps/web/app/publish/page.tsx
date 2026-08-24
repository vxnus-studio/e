import Link from "next/link";
import { PublishForm } from "./publish-form";

export default function PublishPage() {
  return <main className="publish-page"><nav className="publish-nav"><Link className="brand" href="/"><span className="brand-mark">E</span> knowledge hub</Link><Link className="back-link" href="/">← Catalog</Link></nav><section className="publish-layout"><div className="publish-intro"><p className="eyebrow">Publisher workspace</p><h1>Put your knowledge in motion.</h1><p>Upload a portable E pack and we’ll validate its structure before it enters the catalog.</p><div className="publish-rules"><span>01 / manifest checked</span><span>02 / revision verified</span><span>03 / archive fingerprinted</span></div></div><PublishForm /></section></main>;
}
