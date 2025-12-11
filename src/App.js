import logo from './logo.svg';
import './App.css';
import PdfComp from './pdfcomp';
import { pdfjs } from 'react-pdf';
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();
function App() {
  return (
    <div className="MainContainer">
      <ToastContainer></ToastContainer>
      <PdfComp></PdfComp>
    </div>
  );
}

export default App;
