// three.js r128 aus npm, bereitgestellt als globales THREE (mit THREE.OrbitControls),
// so wie es das Programm von der früheren CDN-Einbindung gewohnt ist.
import * as THREE_NS from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

window.THREE = Object.assign({}, THREE_NS, { OrbitControls });
