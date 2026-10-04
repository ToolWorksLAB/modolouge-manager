import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import './globals.css';
import {manager} from '../lib/config.js';
export const metadata={title:manager?'Modolouge Manager — ToolWorksLab':'Modolouge — ToolWorksLab',description:'A space for parametric thinking. Grasshopper definitions, live controls and cloud geometry by ToolWorksLab.',robots:{index:false,follow:false}};
export default function Layout({children}){return <html lang="en"><body>{children}</body></html>;}
