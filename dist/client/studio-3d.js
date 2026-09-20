/* Original Kairós WebGL2 renderer and architectural geometry, adapted from
   tmp/backup-antes-catalogo.html. Mounted only when the 3D studio is opened. */
window.createKairosStudio = function () {
'use strict';
const isMobile=matchMedia('(max-width:700px)').matches;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>t*t*(3-2*t);
const smoother=t=>t*t*t*(t*(t*6-15)+10);
const M4 = {
  ident:()=>new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]),
  mul(a,b,o){
    o=o||new Float32Array(16);
    const a00=a[0],a01=a[1],a02=a[2],a03=a[3],a10=a[4],a11=a[5],a12=a[6],a13=a[7],
          a20=a[8],a21=a[9],a22=a[10],a23=a[11],a30=a[12],a31=a[13],a32=a[14],a33=a[15];
    for(let i=0;i<4;i++){
      const b0=b[i*4],b1=b[i*4+1],b2=b[i*4+2],b3=b[i*4+3];
      o[i*4]  =b0*a00+b1*a10+b2*a20+b3*a30;
      o[i*4+1]=b0*a01+b1*a11+b2*a21+b3*a31;
      o[i*4+2]=b0*a02+b1*a12+b2*a22+b3*a32;
      o[i*4+3]=b0*a03+b1*a13+b2*a23+b3*a33;
    }
    return o;
  },
  persp(fovy,asp,n,f,o){
    o=o||new Float32Array(16);const t=1/Math.tan(fovy/2);
    o.fill(0);o[0]=t/asp;o[5]=t;o[11]=-1;o[10]=(f+n)/(n-f);o[14]=2*f*n/(n-f);return o;
  },
  lookAt(e,c,u,o){
    o=o||new Float32Array(16);
    let zx=e[0]-c[0],zy=e[1]-c[1],zz=e[2]-c[2];
    let l=Math.hypot(zx,zy,zz)||1;zx/=l;zy/=l;zz/=l;
    let xx=u[1]*zz-u[2]*zy,xy=u[2]*zx-u[0]*zz,xz=u[0]*zy-u[1]*zx;
    l=Math.hypot(xx,xy,xz)||1;xx/=l;xy/=l;xz/=l;
    const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;
    o[0]=xx;o[1]=yx;o[2]=zx;o[3]=0;
    o[4]=xy;o[5]=yy;o[6]=zy;o[7]=0;
    o[8]=xz;o[9]=yz;o[10]=zz;o[11]=0;
    o[12]=-(xx*e[0]+xy*e[1]+xz*e[2]);
    o[13]=-(yx*e[0]+yy*e[1]+yz*e[2]);
    o[14]=-(zx*e[0]+zy*e[1]+zz*e[2]);
    o[15]=1;return o;
  },
  trs(p,r,s,o){ // rotação YXZ
    o=o||new Float32Array(16);
    const cx=Math.cos(r[0]),sx=Math.sin(r[0]),cy=Math.cos(r[1]),sy=Math.sin(r[1]),cz=Math.cos(r[2]),sz=Math.sin(r[2]);
    const m00=cy*cz+sy*sx*sz, m01=cx*sz, m02=-sy*cz+cy*sx*sz;
    const m10=-cy*sz+sy*sx*cz, m11=cx*cz, m12=sy*sz+cy*sx*cz;
    const m20=sy*cx, m21=-sx, m22=cy*cx;
    o[0]=m00*s[0];o[1]=m01*s[0];o[2]=m02*s[0];o[3]=0;
    o[4]=m10*s[1];o[5]=m11*s[1];o[6]=m12*s[1];o[7]=0;
    o[8]=m20*s[2];o[9]=m21*s[2];o[10]=m22*s[2];o[11]=0;
    o[12]=p[0];o[13]=p[1];o[14]=p[2];o[15]=1;return o;
  },
  normal3(m,o){ // inversa-transposta 3x3 empacotada em mat3 (col-major, 9 floats)
    o=o||new Float32Array(9);
    const a=m[0],b=m[1],c=m[2],d=m[4],e=m[5],f=m[6],g=m[8],h=m[9],i=m[10];
    const A=e*i-f*h,B=f*g-d*i,C=d*h-e*g;
    let det=a*A+b*B+c*C; det=det?1/det:0;
    o[0]=A*det;o[1]=B*det;o[2]=C*det;
    o[3]=(c*h-b*i)*det;o[4]=(a*i-c*g)*det;o[5]=(b*g-a*h)*det;
    o[6]=(b*f-c*e)*det;o[7]=(c*d-a*f)*det;o[8]=(a*e-b*d)*det;
    return o;
  }
};

/* ============================================================================
   GLSL — biblioteca comum (ruído, pedra procedural, PBR)
   ============================================================================ */
const GLSL_COMMON = `
precision highp float;
const float PI = 3.14159265359;

float hash13(vec3 p){
  p = fract(p*0.3183099 + vec3(0.1,0.2,0.3));
  p *= 17.0;
  return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
}
float vnoise(vec3 x){
  vec3 i = floor(x), f = fract(x);
  f = f*f*f*(f*(f*6.0-15.0)+10.0);
  return mix(mix(mix(hash13(i+vec3(0,0,0)),hash13(i+vec3(1,0,0)),f.x),
                 mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x),
                 mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p, int oct){
  float a = 0.5, s = 0.0, n = 0.0;
  for(int i=0;i<6;i++){
    if(i>=oct) break;
    s += a*vnoise(p); n += a; p *= 2.03; p += vec3(1.7,9.2,4.3)*0.1; a *= 0.5;
  }
  return s/max(n,1e-4);
}
float ridge(float v, float sharp){
  v = 1.0 - abs(v);
  return pow(clamp(v,0.0,1.0), sharp);
}

/* ---- parâmetros da pedra ---- */
uniform vec3  uColA;      // cor de fundo clara
uniform vec3  uColB;      // cor de fundo escura / manchas
uniform vec3  uColVein;   // cor do veio
uniform vec3  uColSpeck;  // cor dos cristais
uniform float uScale;     // escala do padrão
uniform float uVeinFreq;
uniform float uVeinSharp;
uniform float uVeinAmt;
uniform float uWarp;
uniform float uSpeck;     // quantidade de cristais (granito)
uniform float uRough;     // rugosidade base (acabamento)
uniform float uRoughVar;
uniform float uBump;
uniform float uClear;     // camada de polimento
uniform float uTrans;     // translucidez (mármore)
uniform float uBrush;     // estrias do acabamento escovado
uniform int   uOct;       // qualidade

struct Stone { vec3 alb; float h; float rough; float ao; };

Stone stoneAt(vec3 op){
  vec3 p = op * uScale;
  // veios de pedra correm alongados: comprime o eixo vertical
  vec3 ps = vec3(p.x, p.y*0.58, p.z*0.92);

  int o1 = uOct, o2 = max(uOct-1,2);
  float wlow = fbm(ps*0.19 + vec3(2.3,7.7,1.1), 3);   // deriva ampla do veio
  float dens = fbm(ps*0.38 + vec3(8.4,2.2,5.6), 3);   // regiões com mais ou menos veio
  float w1 = fbm(ps*0.72, o1);
  float wa = fbm(ps*0.72 + vec3(4.7,1.3,8.9), o2);
  float wb = fbm(ps*0.72 + vec3(9.1,6.4,2.7), o2);
  float w2 = fbm(ps*1.85 + vec3(w1,wa,wb)*uWarp, o1);

  // ---- fundo: nuvens minerais ----
  float cloud = smoothstep(0.26, 0.80, w1*0.62 + w2*0.48);
  vec3 alb = mix(uColA, uColB, cloud);
  // variação sutil de temperatura
  alb *= 1.0 + (w2-0.5)*0.13;

  // ---- veio largo, difuso (o "fantasma" sob a superfície) ----
  float gf = abs(sin(ps.x*uVeinFreq*0.40 + wlow*9.0 + w1*2.0));
  float ghost = pow(1.0-gf, max(uVeinSharp*0.16, 1.0));
  alb = mix(alb, mix(uColVein, uColB, 0.5), ghost*uVeinAmt*0.55);

  // ---- veio principal, nítido e direcional ----
  float f1 = abs(sin(ps.x*uVeinFreq + wlow*15.0 + w2*2.2 + w1*1.2));
  float v1 = pow(1.0-f1, uVeinSharp*mix(0.55,1.6,wa));   // espessura variável
  // ---- família cruzada, mais fina ----
  float f2 = abs(sin((ps.x*0.80 + ps.y*1.15)*uVeinFreq*1.6 + wlow*11.0 + wa*2.2));
  float v2 = pow(1.0-f2, uVeinSharp*1.7)*0.55;
  // ---- capilares ----
  float f3 = abs(sin(ps.x*uVeinFreq*3.1 + wlow*26.0 + wb*2.0));
  float v3 = pow(1.0-f3, uVeinSharp*3.2)*0.40;
  float vein = clamp(v1 + v2 + v3, 0.0, 1.0)*uVeinAmt;
  vein *= mix(0.22, 1.30, smoothstep(0.26,0.74,dens));   // adensamento irregular

  // halo claro ao redor do veio — assinatura do mármore
  float halo = clamp(pow(1.0-f1, uVeinSharp*0.30) - v1, 0.0, 1.0);
  alb = mix(alb, uColA*1.09, halo*uVeinAmt*0.34);
  alb = mix(alb, uColVein, vein);

  // ---- cristais / grão (granito) ----
  float g1 = vnoise(p*34.0);
  float g2 = vnoise(p*78.0 + 11.0);
  float g3 = vnoise(p*17.0 + 4.0);
  float speck = smoothstep(0.60,0.80,g1) + smoothstep(0.70,0.90,g2)*0.7;
  alb = mix(alb, uColSpeck, clamp(speck*uSpeck,0.0,1.0));
  alb *= 1.0 - smoothstep(0.58,0.16,g2)*uSpeck*0.42;
  alb = mix(alb, alb*0.72, smoothstep(0.62,0.86,g3)*uSpeck*0.5);

  // ---- poros e microrelevo ----
  float pores = vnoise(p*118.0);
  float micro = fbm(p*24.0, 2);
  float h = vein*0.60 + ghost*0.12 + micro*0.30 + (1.0-pores)*0.12 + speck*uSpeck*0.30;

  // estrias do acabamento escovado
  float br = sin(op.x*380.0)*0.5+0.5;
  h += br*uBrush*0.55;

  float rough = uRough
              + (1.0-smoothstep(0.20,0.80,pores))*uRoughVar*0.65
              + vein*uRoughVar*0.45
              + speck*uSpeck*0.12
              + br*uBrush*0.30;

  float ao = mix(0.66, 1.0, smoothstep(0.0,0.55, micro*0.6 + pores*0.4));
  ao *= 1.0 - vein*0.14 - ghost*0.05;

  return Stone(alb, h, clamp(rough,0.02,1.0), clamp(ao,0.4,1.0));
}

/* ---- ambiente procedural (estúdio) ---- */
uniform vec3 uEnvTop, uEnvFloor, uWinCol, uWinDir, uBounceCol, uBounceDir;
uniform float uEnvInt;

/* ---- ambiente capturado (HDRI equiretangular, bytes RGBE em PNG) ----
   O PNG guarda bytes RGBE crus; a decodificacao acontece aqui no shader.
   Isso preserva a faixa dinamica real (a janela do ambiente chega a ~83
   de luminancia) sem precisar de textura float nem parser em JavaScript. */
uniform sampler2D uEnvTex;
uniform float uEnvBlend, uEnvLevel;

vec3 envHDRI(vec3 d, float r){
  float u = atan(d.z, d.x) * 0.15915494309 + 0.5;
  float v = acos(clamp(d.y, -1.0, 1.0)) * 0.31830988618;
  vec4 t = textureLod(uEnvTex, vec2(u, v), r * 8.0);      // mip pela rugosidade
  vec3 rgb = t.rgb * 255.0 * exp2(t.a * 255.0 - 136.0);   // RGBE -> linear
  return rgb * uEnvLevel;
}

vec3 envSample(vec3 d, float r){
  float up = d.y*0.5+0.5;
  vec3 c = mix(uEnvFloor, uEnvTop, pow(up,1.35));
  /* A janela e o rebote sinteticos recuam conforme o HDRI real entra,
     senao as duas fontes de luz se somariam e o reflexo viria dobrado. */
  float w = pow(max(dot(d,normalize(uWinDir)),0.0), mix(300.0, 2.2, r));
  c += uWinCol * w * mix(2.6, 0.55, r) * (1.0 - uEnvBlend*0.85);
  float b = pow(max(dot(d,normalize(uBounceDir)),0.0), mix(60.0, 2.0, r));
  c += uBounceCol * b * 0.55 * (1.0 - uEnvBlend*0.6);
  if(uEnvBlend > 0.001) c = mix(c, envHDRI(d,r), uEnvBlend);
  return c*uEnvInt;
}
vec3 envIrr(vec3 n){
  float up = n.y*0.5+0.5;
  vec3 c = mix(uEnvFloor, uEnvTop, up);
  c += uWinCol * max(dot(n,normalize(uWinDir)),0.0)*0.42;
  c += uBounceCol * max(dot(n,normalize(uBounceDir)),0.0)*0.22;
  return c*uEnvInt;
}
vec3 envBRDF(vec3 F0, float rough, float NoV){
  vec4 c0 = vec4(-1.0,-0.0275,-0.572,0.022);
  vec4 c1 = vec4(1.0,0.0425,1.04,-0.04);
  vec4 r = rough*c0 + c1;
  float a004 = min(r.x*r.x, exp2(-9.28*NoV))*r.x + r.y;
  vec2 ab = vec2(-1.04,1.04)*a004 + r.zw;
  return F0*ab.x + ab.y;
}
float D_GGX(float NoH,float a){
  float a2=a*a; float d=NoH*NoH*(a2-1.0)+1.0;
  return a2/(PI*d*d+1e-7);
}
float V_Smith(float NoV,float NoL,float a){
  float a2=a*a;
  float gv=NoL*sqrt(NoV*NoV*(1.0-a2)+a2);
  float gl=NoV*sqrt(NoL*NoL*(1.0-a2)+a2);
  return 0.5/max(gv+gl,1e-5);
}
vec3 F_Schlick(vec3 F0,float u){ return F0 + (1.0-F0)*pow(1.0-u,5.0); }

/* ---- bump a partir de derivadas de tela (Mikkelsen) ---- */
vec3 perturbN(vec3 N, vec3 wp, float h, float scale){
  vec3 dpx = dFdx(wp), dpy = dFdy(wp);
  float dhx = dFdx(h), dhy = dFdy(h);
  vec3 r1 = cross(dpy, N), r2 = cross(N, dpx);
  float det = dot(dpx, r1);
  vec3 grad = sign(det)*(dhx*r1 + dhy*r2);
  return normalize(abs(det)*N - scale*grad);
}
`;
/* ============================================================================
   ENGINE
   ============================================================================ */
const canvas = document.getElementById('studio-canvas');
let gl = null;
try{
  gl = canvas.getContext('webgl2',{antialias:false,alpha:false,depth:true,stencil:false,
       premultipliedAlpha:false,preserveDrawingBuffer:false,powerPreference:'high-performance',
       failIfMajorPerformanceCaveat:false});
}catch(e){ gl = null; }

const FORCE_NOGL = /[?&]nogl=1/.test(location.search);
if(FORCE_NOGL) gl = null;
const HAS_GL = !!gl;
if(!HAS_GL) throw new Error('WebGL indisponível');

let R = null; // renderer

if(HAS_GL){
R = (function(){
  const hasFloat = !!gl.getExtension('EXT_color_buffer_float');
  gl.getExtension('OES_texture_float_linear');
  const maxSamples = gl.getParameter(gl.MAX_SAMPLES)|0;

  const Q = {
    dpr: Math.min(window.devicePixelRatio||1, isMobile?1.5:2),
    scale: isMobile?0.8:1.0,
    oct: isMobile?3:4,
    bloom: !isMobile,
    msaa: 0,
    parts: isMobile?110:420,
    matSlabs: isMobile?3:5
  };
  // modo leve opcional: index.html?q=low  (útil em máquinas antigas)
  if(/[?&]q=low/.test(location.search)){
    Q.dpr=1;Q.scale=0.4;Q.oct=2;Q.bloom=false;Q.msaa=0;Q.parts=60;
  }
  if(/[?&]q=tiny/.test(location.search)){
    Q.dpr=1;Q.scale=0.22;Q.oct=2;Q.bloom=false;Q.msaa=0;Q.parts=40;
  }

  /* ---------- shaders ---------- */
  function sh(type,src){
    const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){
      console.error(gl.getShaderInfoLog(s),src.split('\n').map((l,i)=>(i+1)+': '+l).join('\n'));
      return null;
    }
    return s;
  }
  function prog(vsrc,fsrc){
    const v=sh(gl.VERTEX_SHADER,'#version 300 es\n'+vsrc);
    const f=sh(gl.FRAGMENT_SHADER,'#version 300 es\n'+fsrc);
    if(!v||!f) return null;
    const p=gl.createProgram();gl.attachShader(p,v);gl.attachShader(p,f);
    gl.bindAttribLocation(p,0,'aPos');gl.bindAttribLocation(p,1,'aNor');gl.bindAttribLocation(p,2,'aSeed');
    gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS)){console.error(gl.getProgramInfoLog(p));return null;}
    const u={},n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
    for(let i=0;i<n;i++){const info=gl.getActiveUniform(p,i);const nm=info.name.replace(/\[0\]$/,'');u[nm]=gl.getUniformLocation(p,nm);}
    return {p,u};
  }
  const U = {
    f (pr,n,v){const l=pr.u[n]; if(l)gl.uniform1f(l,v);},
    i (pr,n,v){const l=pr.u[n]; if(l)gl.uniform1i(l,v);},
    v2(pr,n,x,y){const l=pr.u[n]; if(l)gl.uniform2f(l,x,y);},
    v3(pr,n,a){const l=pr.u[n]; if(l)gl.uniform3f(l,a[0],a[1],a[2]);},
    v4(pr,n,a){const l=pr.u[n]; if(l)gl.uniform4f(l,a[0],a[1],a[2],a[3]);},
    m4(pr,n,m){const l=pr.u[n]; if(l)gl.uniformMatrix4fv(l,false,m);},
    m3(pr,n,m){const l=pr.u[n]; if(l)gl.uniformMatrix3fv(l,false,m);}
  };

  /* ---------- geometria ---------- */
  function buildVAO(pos,nor,idx,extra){
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);
    const b1=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b1);
    gl.bufferData(gl.ARRAY_BUFFER,pos,gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);
    if(nor){
      const b2=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b2);
      gl.bufferData(gl.ARRAY_BUFFER,nor,gl.STATIC_DRAW);
      gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,0,0);
    }
    if(extra){
      const b3=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b3);
      gl.bufferData(gl.ARRAY_BUFFER,extra,gl.STATIC_DRAW);
      gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,3,gl.FLOAT,false,0,0);
    }
    let count;
    if(idx){
      const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,idx,gl.STATIC_DRAW);count=idx.length;
    }else count=pos.length/3;
    gl.bindVertexArray(null);
    return {vao,count,indexed:!!idx};
  }

  // caixa com cantos arredondados: p = core + r*normalize(q)
  function roundedBox(w,h,d,r,seg){
    const W=w/2,H=h/2,D=d/2;
    r=Math.min(r,W*0.98,H*0.98,D*0.98);
    const hx=W-r,hy=H-r,hz=D-r;
    const pos=[],nor=[],idx=[];
    const faces=[
      [[1,0,0],[0,1,0],[0,0,1]],[[-1,0,0],[0,1,0],[0,0,-1]],
      [[0,1,0],[0,0,1],[1,0,0]],[[0,-1,0],[0,0,-1],[1,0,0]],
      [[0,0,1],[0,1,0],[-1,0,0]],[[0,0,-1],[0,1,0],[1,0,0]]
    ];
    for(const [n,uax,vax] of faces){
      const base=pos.length/3;
      for(let j=0;j<=seg;j++){
        const vv=j/seg*2-1;
        for(let i=0;i<=seg;i++){
          const uu=i/seg*2-1;
          const q=[n[0]+uax[0]*uu+vax[0]*vv, n[1]+uax[1]*uu+vax[1]*vv, n[2]+uax[2]*uu+vax[2]*vv];
          const L=Math.hypot(q[0],q[1],q[2])||1;
          const nx=q[0]/L,ny=q[1]/L,nz=q[2]/L;
          pos.push(q[0]*hx+nx*r, q[1]*hy+ny*r, q[2]*hz+nz*r);
          nor.push(nx,ny,nz);
        }
      }
      for(let j=0;j<seg;j++)for(let i=0;i<seg;i++){
        const a=base+j*(seg+1)+i,b=a+1,c=a+seg+1,e=c+1;
        idx.push(a,b,c, b,e,c);
      }
    }
    return buildVAO(new Float32Array(pos),new Float32Array(nor),
      (pos.length/3>65535)?new Uint32Array(idx):new Uint16Array(idx));
  }
  function planeXY(w,h,sx,sy){
    const pos=[],nor=[],idx=[];
    for(let j=0;j<=sy;j++)for(let i=0;i<=sx;i++){
      pos.push((i/sx-0.5)*w,(j/sy-0.5)*h,0);nor.push(0,0,1);
    }
    for(let j=0;j<sy;j++)for(let i=0;i<sx;i++){
      const a=j*(sx+1)+i,b=a+1,c=a+sx+1,e=c+1;idx.push(a,b,c,b,e,c);
    }
    return buildVAO(new Float32Array(pos),new Float32Array(nor),new Uint16Array(idx));
  }
  function fsTri(){
    return buildVAO(new Float32Array([-1,-1,0, 3,-1,0, -1,3,0]),null,null);
  }

  const GEO = {
    slab   : roundedBox(1,1,1,0.06,isMobile?12:20),
    slabHi : roundedBox(1,1,1,0.04,isMobile?16:30),
    box    : roundedBox(1,1,1,0.03,8),
    plane  : planeXY(1,1,1,1),
    planeHi: planeXY(1,1,24,24),
    tri    : fsTri()
  };

  /* ---------- programas ---------- */
  const VS_MESH = `
  layout(location=0) in vec3 aPos;
  layout(location=1) in vec3 aNor;
  uniform mat4 uP,uV,uM; uniform mat3 uN; uniform vec3 uOScale;
  out vec3 vWP; out vec3 vNn; out vec3 vOP;
  void main(){
    vec4 wp = uM*vec4(aPos,1.0);
    vWP = wp.xyz; vNn = uN*aNor; vOP = aPos*uOScale;
    gl_Position = uP*uV*wp;
  }`;

  const FS_STONE = GLSL_COMMON + `
  in vec3 vWP; in vec3 vNn; in vec3 vOP;
  uniform vec3 uCam;
  uniform vec3 uL1Dir,uL1Col,uL2Dir,uL2Col;
  uniform float uAlpha, uExpo;
  uniform vec3 uClipN; uniform float uClipD, uClipOn, uGlowEdge;
  out vec4 outColor;
  void main(){
    if(uClipOn>0.5 && dot(vWP,normalize(uClipN)) > uClipD) discard;

    vec3 N = normalize(vNn);
    if(!gl_FrontFacing) N = -N;
    vec3 V = normalize(uCam - vWP);

    Stone s = stoneAt(vOP);
    N = perturbN(N, vWP, s.h, uBump);
    float NoV = clamp(dot(N,V),1e-4,1.0);

    vec3 alb = s.alb;
    float rough = clamp(s.rough,0.03,1.0);
    float a = rough*rough;
    vec3 F0 = vec3(0.05);

    vec3 col = vec3(0.0);

    // luz principal
    {
      vec3 L = normalize(uL1Dir);
      vec3 H = normalize(L+V);
      float NoL = clamp(dot(N,L),0.0,1.0);
      float NoH = clamp(dot(N,H),0.0,1.0);
      float VoH = clamp(dot(V,H),0.0,1.0);
      vec3 F = F_Schlick(F0,VoH);
      vec3 spec = F*D_GGX(NoH,a)*V_Smith(NoV,NoL,a);
      float wrap = clamp((dot(N,L)+0.35)/1.35,0.0,1.0);
      col += uL1Col*(alb*wrap/PI + spec*NoL);
      // translucidez (mármore)
      float back = pow(clamp(dot(V,-L)*0.5+0.5,0.0,1.0),2.5);
      col += uL1Col*alb*back*uTrans*0.55;
    }
    // luz de recorte
    {
      vec3 L = normalize(uL2Dir);
      vec3 H = normalize(L+V);
      float NoL = clamp(dot(N,L),0.0,1.0);
      float NoH = clamp(dot(N,H),0.0,1.0);
      vec3 F = F_Schlick(F0,clamp(dot(V,H),0.0,1.0));
      col += uL2Col*(alb*NoL*0.34/PI + F*D_GGX(NoH,a)*V_Smith(NoV,NoL,a)*NoL);
    }

    // ambiente
    vec3 Rv = reflect(-V,N);
    vec3 irr = envIrr(N);
    col += alb*irr*0.30;
    col += envSample(Rv,rough)*envBRDF(F0,rough,NoV);

    // camada de polimento
    if(uClear>0.01){
      float ca=0.045;
      vec3 Lc=normalize(uL1Dir); vec3 Hc=normalize(Lc+V);
      float NoHc=clamp(dot(N,Hc),0.0,1.0);
      float NoLc=clamp(dot(N,Lc),0.0,1.0);
      float Fc=0.04+0.96*pow(1.0-NoV,5.0);
      vec3 cc = uL1Col*D_GGX(NoHc,ca)*V_Smith(NoV,NoLc,ca)*NoLc*Fc;
      cc += envSample(Rv,0.055)*Fc*0.50;
      col = col*(1.0-Fc*uClear*0.35) + cc*uClear;
    }

    col *= mix(1.0, s.ao, 0.85);

    // brilho de aresta (revela a espessura)
    float rim = pow(1.0-NoV,4.0);
    col += uGlowEdge*rim*vec3(0.55,0.46,0.34);

    outColor = vec4(col*uExpo, uAlpha);
  }`;

  const FS_MATTE = GLSL_COMMON + `
  in vec3 vWP; in vec3 vNn; in vec3 vOP;
  uniform vec3 uCam, uL1Dir,uL1Col,uL2Dir,uL2Col,uMatCol,uMatEmis;
  uniform float uAlpha,uExpo,uMatRough;
  out vec4 outColor;
  void main(){
    vec3 N=normalize(vNn); if(!gl_FrontFacing) N=-N;
    vec3 V=normalize(uCam-vWP);
    float grain = fbm(vOP*18.0,2);
    N = perturbN(N,vWP,grain,0.012);
    vec3 alb = uMatCol*(0.93+grain*0.14);
    float NoV=clamp(dot(N,V),1e-4,1.0);
    float rough=uMatRough,a=rough*rough;
    vec3 F0=vec3(0.035);
    vec3 col=vec3(0.0);
    vec3 L=normalize(uL1Dir),H=normalize(L+V);
    float NoL=clamp(dot(N,L),0.0,1.0);
    col += uL1Col*(alb*clamp((dot(N,L)+0.4)/1.4,0.0,1.0)/PI
         + F_Schlick(F0,clamp(dot(V,H),0.0,1.0))*D_GGX(clamp(dot(N,H),0.0,1.0),a)*V_Smith(NoV,NoL,a)*NoL);
    vec3 L2=normalize(uL2Dir);
    col += uL2Col*alb*clamp(dot(N,L2),0.0,1.0)*0.3/PI;
    col += alb*envIrr(N)*0.34;
    col += envSample(reflect(-V,N),rough)*envBRDF(F0,rough,NoV)*0.7;
    col += uMatEmis;
    outColor=vec4(col*uExpo,uAlpha);
  }`;

  const FS_BG = `
  precision highp float;
  uniform vec2 uRes; uniform float uT,uMode,uAlpha;
  uniform vec3 uTop,uBot,uGlow; uniform vec2 uGlowPos; uniform float uGlowR;
  out vec4 outColor;
  float h21(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}
  void main(){
    vec2 uv = gl_FragCoord.xy/uRes;
    vec3 c = mix(uBot,uTop,pow(uv.y,1.25));
    vec2 d = (uv-uGlowPos); d.x *= uRes.x/uRes.y;
    float g = exp(-dot(d,d)/max(uGlowR,1e-4));
    c += uGlow*g;
    float vig = smoothstep(1.25,0.25,length((uv-0.5)*vec2(1.35,1.0)));
    c *= mix(0.55,1.0,vig);
    c += (h21(gl_FragCoord.xy+uT)-0.5)*0.004;
    outColor = vec4(c,uAlpha);
  }`;

  const VS_PT = `
  layout(location=2) in vec3 aSeed;
  uniform mat4 uP,uV; uniform float uT,uSize,uMode,uSpread,uProg;
  uniform vec3 uOrigin;
  out float vA;
  float h(float x){return fract(sin(x*127.1)*43758.5453);}
  void main(){
    vec3 s=aSeed;
    vec3 p;
    float life=fract(s.z*7.13 + uT*(0.05+s.x*0.05));
    if(uMode<0.5){
      // poeira suspensa no showroom
      p = vec3((s.x-0.5)*uSpread, (s.y-0.5)*uSpread*0.62, (s.z-0.5)*uSpread*0.7);
      p.y += sin(uT*0.28 + s.x*30.0)*0.16;
      p.x += cos(uT*0.21 + s.y*24.0)*0.12;
      vA = (0.22+0.55*h(s.x*13.0))*(0.55+0.45*sin(uT*0.7+s.z*20.0));
    }else{
      // pó de pedra no corte
      float ang = s.x*6.2831;
      float sp = 0.25+s.y*0.75;
      p = uOrigin;
      p.y += (s.z-0.5)*1.9;
      p += vec3(cos(ang)*0.16, 0.0, sin(ang)*0.16)*life*sp*3.0;
      p.y -= life*life*1.1*sp;
      vA = (1.0-life)*0.75*smoothstep(0.0,0.06,uProg)*smoothstep(1.0,0.85,uProg);
    }
    gl_Position = uP*uV*vec4(p,1.0);
    gl_PointSize = uSize*(1.0+h(s.y*9.0)*1.6)/max(gl_Position.w,0.25);
  }`;
  const FS_PT = `
  precision mediump float; in float vA; uniform vec3 uCol; uniform float uAlpha;
  out vec4 outColor;
  void main(){
    vec2 d=gl_PointCoord-0.5;
    float m=smoothstep(0.5,0.02,length(d));
    outColor=vec4(uCol*m,m*vA*uAlpha);
  }`;

  const VS_QUAD = `layout(location=0) in vec3 aPos; out vec2 vUv;
    void main(){ vUv=aPos.xy*0.5+0.5; gl_Position=vec4(aPos.xy,0.0,1.0); }`;

  const FS_BRIGHT = `precision highp float; in vec2 vUv; uniform sampler2D uTex; uniform float uThr;
    out vec4 outColor;
    void main(){ vec3 c=texture(uTex,vUv).rgb; float l=dot(c,vec3(.2126,.7152,.0722));
      outColor=vec4(c*smoothstep(uThr,uThr+0.85,l),1.0); }`;

  const FS_BLUR = `precision highp float; in vec2 vUv; uniform sampler2D uTex; uniform vec2 uDir;
    out vec4 outColor;
    void main(){
      vec3 c=texture(uTex,vUv).rgb*0.2270270270;
      c+=texture(uTex,vUv+uDir*1.3846153846).rgb*0.3162162162;
      c+=texture(uTex,vUv-uDir*1.3846153846).rgb*0.3162162162;
      c+=texture(uTex,vUv+uDir*3.2307692308).rgb*0.0702702703;
      c+=texture(uTex,vUv-uDir*3.2307692308).rgb*0.0702702703;
      outColor=vec4(c,1.0);
    }`;

  const FS_COMP = `precision highp float; in vec2 vUv;
    uniform sampler2D uTex,uBloom; uniform float uBloomAmt,uT,uGrain,uVig,uCa,uFade;
    out vec4 outColor;
    float h21(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}
    vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
    void main(){
      vec2 uv=vUv;
      vec2 off=(uv-0.5)*uCa;
      vec3 c;
      c.r=texture(uTex,uv+off).r; c.g=texture(uTex,uv).g; c.b=texture(uTex,uv-off).b;
      c += texture(uBloom,uv).rgb*uBloomAmt;
      c = aces(c*1.02);
      c = pow(c, vec3(1.0/2.2));
      float vig=smoothstep(1.32,0.35,length((uv-0.5)*vec2(1.28,1.0)));
      c*=mix(1.0-uVig,1.0,vig);
      c += (h21(uv*vec2(1920.0,1080.0)+uT)-0.5)*uGrain;
      outColor=vec4(c*uFade,1.0);
    }`;

  const P = {
    stone : prog(VS_MESH,FS_STONE),
    matte : prog(VS_MESH,FS_MATTE),
    bg    : prog(VS_QUAD,FS_BG),
    pt    : prog(VS_PT,FS_PT),
    bright: prog(VS_QUAD,FS_BRIGHT),
    blur  : prog(VS_QUAD,FS_BLUR),
    comp  : prog(VS_QUAD,FS_COMP)
  };
  if(!P.stone||!P.matte||!P.bg||!P.comp) return null;

  /* ---------- partículas ---------- */
  function makePoints(n){
    const a=new Float32Array(n*3);
    for(let i=0;i<n*3;i++) a[i]=Math.random();
    return buildVAO(new Float32Array(n*3),null,null,a);
  }
  const PT_DUST = makePoints(Q.parts);
  const PT_CUT  = makePoints(isMobile?70:220);

  /* ---------- framebuffers ---------- */
  function tex(w,h,fmt,ifmt,type,filter){
    const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texImage2D(gl.TEXTURE_2D,0,ifmt,w,h,0,fmt,type,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    return t;
  }
  const IFMT = hasFloat? gl.RGBA16F : gl.RGBA8;
  const TYPE = hasFloat? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
  let FB = null;
  function makeFBs(w,h){
    if(FB){
      [FB.msFbo,FB.fbo,FB.b1,FB.b2].forEach(f=>f&&gl.deleteFramebuffer(f));
      [FB.color,FB.t1,FB.t2].forEach(t=>t&&gl.deleteTexture(t));
      [FB.msColor,FB.msDepth,FB.depth].forEach(r=>r&&gl.deleteRenderbuffer(r));
    }
    const bw=Math.max(2,w>>2),bh=Math.max(2,h>>2);
    const o={w,h,bw,bh};
    o.color=tex(w,h,gl.RGBA,IFMT,TYPE,gl.LINEAR);
    o.fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,o.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,o.color,0);
    o.depth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,o.depth);
    gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT24,w,h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,o.depth);

    if(Q.msaa>1){
      o.msFbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,o.msFbo);
      o.msColor=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,o.msColor);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER,Q.msaa,IFMT,w,h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,o.msColor);
      o.msDepth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,o.msDepth);
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER,Q.msaa,gl.DEPTH_COMPONENT24,w,h);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,o.msDepth);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){
        gl.deleteFramebuffer(o.msFbo);o.msFbo=null;Q.msaa=0;
      }
    }
    if(Q.bloom){
      o.t1=tex(bw,bh,gl.RGBA,IFMT,TYPE,gl.LINEAR);
      o.t2=tex(bw,bh,gl.RGBA,IFMT,TYPE,gl.LINEAR);
      o.b1=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,o.b1);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,o.t1,0);
      o.b2=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,o.b2);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,o.t2,0);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    FB=o;
  }

  let VW=0,VH=0;
  function resize(){
    const bounds=canvas.parentElement.getBoundingClientRect();
    const w=Math.max(1,Math.round(bounds.width)), h=Math.max(1,Math.round(bounds.height));
    
    const pw=Math.round(w*Q.dpr*Q.scale), ph=Math.round(h*Q.dpr*Q.scale);
    if(pw===VW&&ph===VH) return;
    VW=pw;VH=ph;canvas.width=pw;canvas.height=ph;
    makeFBs(pw,ph);
  }

  /* ---------- presets de pedra ---------- */
  const S = (o)=>Object.assign({
    colA:[0.78,0.77,0.74], colB:[0.55,0.54,0.51], vein:[0.42,0.41,0.39], speckCol:[0.2,0.19,0.18],
    scale:1.0, veinFreq:6.0, veinSharp:9.0, veinAmt:0.55, warp:2.4,
    speck:0.0, rough:0.13, roughVar:0.16, bump:0.020, clear:0.7, trans:0.16, brush:0.0
  },o);
  const PRESET = {
    branco : S({colA:[0.858,0.845,0.812],colB:[0.575,0.572,0.556],vein:[0.255,0.268,0.286],
                scale:0.72,veinFreq:6.4,veinSharp:9.0,veinAmt:0.66,warp:2.2,trans:0.30,
                rough:0.10,roughVar:0.15,bump:0.017,clear:0.85}),
    preto  : S({colA:[0.062,0.060,0.058],colB:[0.024,0.024,0.023],vein:[0.105,0.105,0.108],
                speckCol:[0.34,0.335,0.345],speck:0.62,scale:2.3,veinAmt:0.14,veinFreq:9.0,
                rough:0.095,roughVar:0.10,trans:0.0,bump:0.013,clear:0.9}),
    dourado: S({colA:[0.795,0.748,0.652],colB:[0.545,0.478,0.362],vein:[0.655,0.462,0.176],
                scale:0.60,veinFreq:5.2,veinSharp:6.5,veinAmt:0.82,warp:2.6,trans:0.34,
                rough:0.095,roughVar:0.14,bump:0.023,clear:0.85}),
    cinza  : S({colA:[0.360,0.354,0.344],colB:[0.196,0.194,0.190],vein:[0.245,0.245,0.248],
                speckCol:[0.66,0.65,0.62],speck:0.50,scale:2.0,veinAmt:0.22,veinFreq:8.0,rough:0.15,
                roughVar:0.18,trans:0.03,bump:0.017,clear:0.65}),
    branca : S({colA:[0.900,0.894,0.878],colB:[0.815,0.810,0.798],vein:[0.755,0.752,0.744],
                scale:1.05,veinAmt:0.20,veinFreq:4.2,speck:0.08,speckCol:[0.76,0.755,0.745],
                rough:0.095,roughVar:0.06,trans:0.22,bump:0.008,clear:0.9}),
    hero   : S({colA:[0.822,0.806,0.772],colB:[0.478,0.478,0.472],vein:[0.185,0.198,0.218],
                scale:0.58,veinFreq:6.8,veinSharp:8.0,veinAmt:0.76,warp:2.4,trans:0.28,
                rough:0.10,roughVar:0.15,bump:0.020,clear:0.85})
  };
  function applyStone(pr,s,octBias){
    U.v3(pr,'uColA',s.colA);U.v3(pr,'uColB',s.colB);U.v3(pr,'uColVein',s.vein);U.v3(pr,'uColSpeck',s.speckCol);
    U.f(pr,'uScale',s.scale);U.f(pr,'uVeinFreq',s.veinFreq);U.f(pr,'uVeinSharp',s.veinSharp);
    U.f(pr,'uVeinAmt',s.veinAmt);U.f(pr,'uWarp',s.warp);U.f(pr,'uSpeck',s.speck);
    U.f(pr,'uRough',s.rough);U.f(pr,'uRoughVar',s.roughVar);U.f(pr,'uBump',s.bump);
    U.f(pr,'uClear',s.clear);U.f(pr,'uTrans',s.trans);U.f(pr,'uBrush',s.brush);
    U.i(pr,'uOct',Math.max(2,Q.oct+(octBias||0)));
  }

  /* ---------- ambiente / luz ---------- */
  /* Estúdio de luz do dia: ambiente de céu lidera, preenchimento neutro-frio.
     (A versão noturna era um ambiente quente e escuro com pouca luz de topo.) */
  const ENV = {
    top:[0.34,0.36,0.40], floor:[0.055,0.053,0.050],
    winCol:[1.28,1.26,1.18], winDir:[-0.42,0.72,0.55],
    bounceCol:[0.42,0.38,0.31], bounceDir:[0.86,-0.18,0.42],
    int:1.0,
    l1Dir:[-0.45,0.78,0.62], l1Col:[1.42,1.40,1.34],
    l2Dir:[0.82,0.16,-0.55], l2Col:[0.52,0.48,0.42]
  };
  function applyEnv(pr){
    U.v3(pr,'uEnvTop',ENV.top);U.v3(pr,'uEnvFloor',ENV.floor);
    U.v3(pr,'uWinCol',ENV.winCol);U.v3(pr,'uWinDir',ENV.winDir);
    U.v3(pr,'uBounceCol',ENV.bounceCol);U.v3(pr,'uBounceDir',ENV.bounceDir);
    U.f(pr,'uEnvInt',ENV.int);
    U.v3(pr,'uL1Dir',ENV.l1Dir);U.v3(pr,'uL1Col',ENV.l1Col);
    U.v3(pr,'uL2Dir',ENV.l2Dir);U.v3(pr,'uL2Col',ENV.l2Col);
    /* ambiente capturado — o shader mistura conforme uEnvBlend sobe */
    gl.activeTexture(gl.TEXTURE0 + UNIT_ENV);
    gl.bindTexture(gl.TEXTURE_2D, ENVT.tex || envFallback);
    U.i(pr,'uEnvTex',UNIT_ENV);
    U.f(pr,'uEnvBlend',ENVT.on);
    U.f(pr,'uEnvLevel',ENVT.level);
    gl.activeTexture(gl.TEXTURE0);
  }

  /* ---------- câmera ---------- */
  const CAM = {pos:[0,0,5],tgt:[0,0,0],fov:38,
               P:M4.ident(),V:M4.ident()};
  const tmpM=new Float32Array(16), tmpN=new Float32Array(9);

  /* ---------- ambiente capturado (IBL) ----------
     O PNG carrega DEPOIS do primeiro quadro: a cena ja aparece montada com o
     ambiente analitico, e o reflexo real entra por cima em rampa suave. Assim
     nada quebra se o arquivo demorar ou falhar. */
  const ENVT = { tex:null, on:0, target:0, level:0.6 };
  const UNIT_ENV = 2;
  function makeEnvFallback(){
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,
                  new Uint8Array([0,0,0,0]));
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    return t;
  }
  const envFallback = makeEnvFallback();
  function loadEnv(url){
    const img = new Image();
    img.decoding = 'async';
    img.onload = function(){
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.bindTexture(gl.TEXTURE_2D, envFallback);
      ENVT.tex = t;
      ENVT.target = 0.8;
      ENVT.on = 0.8;
      requestRender();   // nao chega a 1.0: o ambiente analitico segue contribuindo
      ENVT.level  = 0.6;   // << principal botao de ajuste da forca do reflexo
    };
    img.onerror = function(){ ENVT.target = 0; };
    img.src = url;
  }

  /* ---------- API de desenho ---------- */
  let curProg=null;
  function use(pr){ if(curProg!==pr){gl.useProgram(pr.p);curProg=pr;} }

  function drawMesh(geo,pos,rot,scl,stone,opt){
    opt=opt||{};
    const pr = opt.matte? P.matte : P.stone;
    use(pr);
    applyEnv(pr);
    U.m4(pr,'uP',CAM.P);U.m4(pr,'uV',CAM.V);U.v3(pr,'uCam',CAM.pos);
    M4.trs(pos,rot,scl,tmpM);M4.normal3(tmpM,tmpN);
    U.m4(pr,'uM',tmpM);U.m3(pr,'uN',tmpN);
    U.v3(pr,'uOScale',scl);
    U.f(pr,'uAlpha',opt.alpha===undefined?1:opt.alpha);
    U.f(pr,'uExpo',opt.expo===undefined?1:opt.expo);
    if(opt.matte){
      U.v3(pr,'uMatCol',opt.col||[0.14,0.135,0.128]);
      U.v3(pr,'uMatEmis',opt.emis||[0,0,0]);
      U.f(pr,'uMatRough',opt.rough===undefined?0.72:opt.rough);
    }else{
      applyStone(pr,stone,opt.octBias);
      U.f(pr,'uGlowEdge',opt.glow||0);
      if(opt.clip){ U.v3(pr,'uClipN',opt.clip.n);U.f(pr,'uClipD',opt.clip.d);U.f(pr,'uClipOn',1); }
      else U.f(pr,'uClipOn',0);
    }
    if(opt.doubleSided) gl.disable(gl.CULL_FACE); else gl.enable(gl.CULL_FACE);
    gl.bindVertexArray(geo.vao);
    if(geo.indexed) gl.drawElements(gl.TRIANGLES,geo.count,
      geo.count>65535?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT,0);
    else gl.drawArrays(gl.TRIANGLES,0,geo.count);
  }

  function drawBG(o){
    use(P.bg);
    U.v2(P.bg,'uRes',VW,VH);U.f(P.bg,'uT',o.t||0);
    U.v3(P.bg,'uTop',o.top);U.v3(P.bg,'uBot',o.bot);U.v3(P.bg,'uGlow',o.glow);
    U.v2(P.bg,'uGlowPos',o.gx,o.gy);U.f(P.bg,'uGlowR',o.gr);U.f(P.bg,'uAlpha',1);
    gl.disable(gl.DEPTH_TEST);gl.depthMask(false);
    gl.bindVertexArray(GEO.tri.vao);gl.drawArrays(gl.TRIANGLES,0,3);
    gl.enable(gl.DEPTH_TEST);gl.depthMask(true);
  }

  function drawPoints(geo,o){
    if(!P.pt) return;
    use(P.pt);
    U.m4(P.pt,'uP',CAM.P);U.m4(P.pt,'uV',CAM.V);
    U.f(P.pt,'uT',o.t);U.f(P.pt,'uSize',o.size);U.f(P.pt,'uMode',o.mode);
    U.f(P.pt,'uSpread',o.spread||6);U.f(P.pt,'uProg',o.prog||0);
    U.v3(P.pt,'uOrigin',o.origin||[0,0,0]);
    U.v3(P.pt,'uCol',o.col||[1,0.93,0.8]);U.f(P.pt,'uAlpha',o.alpha===undefined?1:o.alpha);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.depthMask(false);
    gl.bindVertexArray(geo.vao);gl.drawArrays(gl.POINTS,0,geo.count);
    gl.depthMask(true);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  }

  function beginFrame(){
    resize();
    gl.bindFramebuffer(gl.FRAMEBUFFER, Q.msaa>1? FB.msFbo : FB.fbo);
    gl.viewport(0,0,VW,VH);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);
    gl.clearColor(0.200,0.205,0.215,1);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    curProg=null;
  }
  function setCamera(pos,tgt,fov){
    CAM.pos=pos;CAM.tgt=tgt;CAM.fov=fov;
    M4.persp(fov*Math.PI/180, VW/VH, 0.02, 120, CAM.P);
    M4.lookAt(pos,tgt,[0,1,0],CAM.V);
  }
  function endFrame(post){
    if(Q.msaa>1){
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER,FB.msFbo);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,FB.fbo);
      gl.blitFramebuffer(0,0,VW,VH,0,0,VW,VH,gl.COLOR_BUFFER_BIT,gl.NEAREST);
    }
    gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(GEO.tri.vao);

    if(Q.bloom && P.bright && P.blur){
      gl.viewport(0,0,FB.bw,FB.bh);
      use(P.bright);gl.bindFramebuffer(gl.FRAMEBUFFER,FB.b1);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,FB.color);
      U.i(P.bright,'uTex',0);U.f(P.bright,'uThr',post.thr||0.85);
      gl.drawArrays(gl.TRIANGLES,0,3);
      use(P.blur);
      for(let i=0;i<2;i++){
        gl.bindFramebuffer(gl.FRAMEBUFFER,FB.b2);
        gl.bindTexture(gl.TEXTURE_2D,FB.t1);U.i(P.blur,'uTex',0);
        U.v2(P.blur,'uDir',1.15/FB.bw,0);gl.drawArrays(gl.TRIANGLES,0,3);
        gl.bindFramebuffer(gl.FRAMEBUFFER,FB.b1);
        gl.bindTexture(gl.TEXTURE_2D,FB.t2);
        U.v2(P.blur,'uDir',0,1.15/FB.bh);gl.drawArrays(gl.TRIANGLES,0,3);
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    gl.viewport(0,0,VW,VH);
    use(P.comp);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,FB.color);U.i(P.comp,'uTex',0);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,Q.bloom?FB.t1:FB.color);U.i(P.comp,'uBloom',1);
    U.f(P.comp,'uBloomAmt',Q.bloom?(post.bloom===undefined?0.5:post.bloom):0);
    U.f(P.comp,'uT',post.t||0);U.f(P.comp,'uGrain',post.grain===undefined?0.022:post.grain);
    U.f(P.comp,'uVig',post.vig===undefined?0.42:post.vig);
    U.f(P.comp,'uCa',post.ca===undefined?0.0016:post.ca);
    U.f(P.comp,'uFade',post.fade===undefined?1:post.fade);
    gl.drawArrays(gl.TRIANGLES,0,3);
    gl.activeTexture(gl.TEXTURE0);
  }

  return {gl,Q,GEO,P,U,PRESET,ENV,CAM,PT_DUST,PT_CUT,ENVT,loadEnv,
          drawMesh,drawBG,drawPoints,beginFrame,endFrame,setCamera,resize,
          get vw(){return VW}, get vh(){return VH}, get asp(){return VH?VW/VH:1.6}};
})();
if(!R) throw new Error('Não foi possível iniciar o estúdio');
}
const GLOK = !!R;
/* O ambiente capturado comeca a baixar so depois do primeiro quadro, para
   nao competir com o carregamento inicial da pagina. */
if(GLOK){
  const kick=()=>R.loadEnv('assets/ibl/estudio_dia.png');
  setTimeout(kick,0);
}
/* acabamentos: [rough, clear, brush, roughVar] */
const FIN = [ [0.055,0.95,0.0,0.10], [0.24,0.35,0.0,0.20], [0.42,0.10,0.55,0.26] ];

function stoneFor(name){ return Object.assign({},R.PRESET[name]); }
function withFinish(s,f){
  const a=FIN[Math.floor(f)]||FIN[0], b=FIN[Math.ceil(f)]||a, k=f-Math.floor(f);
  s.rough=lerp(a[0],b[0],k); s.clear=lerp(a[1],b[1],k);
  s.brush=lerp(a[2],b[2],k); s.roughVar=lerp(a[3],b[3],k);
  return s;
}

/* ---------- cenário arquitetônico ---------- */
const WALL=[0.480,0.475,0.462], WALL2=[0.360,0.355,0.345], FLOORC=[0.270,0.265,0.255];
function drawRoomShell(al){
  if(al<0.01) return;
  const ds={matte:true,alpha:al,doubleSided:true};
  R.drawMesh(R.GEO.planeHi,[0,-1.25,-1.2],[-Math.PI/2,0,0],[16,16,1],null,Object.assign({col:FLOORC,rough:0.55},ds));
  R.drawMesh(R.GEO.planeHi,[0,1.35,-3.1],[0,0,0],[13,5.4,1],null,Object.assign({col:WALL,rough:0.85},ds));
  R.drawMesh(R.GEO.planeHi,[-4.6,1.35,-1.0],[0,Math.PI/2,0],[5.0,5.4,1],null,Object.assign({col:WALL2,rough:0.85},ds));
}
function drawStage(stage,al,st,t){
  if(al<0.01) return;
  const o={alpha:al};
  if(stage===0){ // chapa
    R.drawMesh(R.GEO.slabHi,[0,0.05,0],[ -0.06, 0.5+t*0.05, 0],heroScale(),st,o);
  }else if(stage===1){ // bancada de cozinha
    drawRoomShell(al);
    R.drawMesh(R.GEO.box,[0,-0.86,-0.55],[0,0,0],[3.4,0.78,1.0],null,{matte:true,col:[0.085,0.082,0.078],rough:0.6,alpha:al});
    R.drawMesh(R.GEO.slab,[0,-0.43,-0.55],[0,0,0],[3.6,0.075,1.12],st,o);
    R.drawMesh(R.GEO.slab,[0,0.10,-1.06],[0,0,0],[3.6,1.0,0.05],st,o);
    R.drawMesh(R.GEO.box,[-1.4,-0.30,-0.35],[0,0,0],[0.55,0.19,0.42],null,{matte:true,col:[0.30,0.30,0.31],rough:0.22,alpha:al});
  }else if(stage===2){ // ilha gourmet
    drawRoomShell(al);
    R.drawMesh(R.GEO.slab,[0,-0.30,0],[0,0,0],[2.6,0.085,1.35],st,o);
    R.drawMesh(R.GEO.slab,[-1.24,-0.79,0],[0,0,0],[0.085,0.95,1.35],st,o);
    R.drawMesh(R.GEO.slab,[ 1.24,-0.79,0],[0,0,0],[0.085,0.95,1.35],st,o);
    R.drawMesh(R.GEO.box,[0,-0.80,0],[0,0,0],[2.3,0.92,1.15],null,{matte:true,col:[0.050,0.049,0.047],rough:0.94,alpha:al});
    R.drawMesh(R.GEO.slab,[0,0.30,-3.02],[0,0,0],[4.6,2.0,0.06],st,{alpha:al*0.9});
  }else if(stage===3){ // lavabo
    drawRoomShell(al);
    R.drawMesh(R.GEO.slab,[0,-0.20,-0.9],[0,0,0],[1.9,0.07,0.62],st,o);
    R.drawMesh(R.GEO.box,[0,-0.34,-0.9],[0,0,0],[0.7,0.20,0.42],null,{matte:true,col:[0.045,0.044,0.042],rough:0.4,alpha:al});
    R.drawMesh(R.GEO.slab,[0,0.62,-1.24],[0,0,0],[1.9,1.5,0.05],st,o);
    R.drawMesh(R.GEO.box,[0,0.05,-1.15],[0,0,0],[0.045,0.30,0.045],null,{matte:true,col:[0.42,0.40,0.36],rough:0.12,alpha:al});
  }else{ // escada
    drawRoomShell(al);
    for(let i=0;i<5;i++){
      const y=-1.05+i*0.30, z=0.9-i*0.42;
      // estrutura (contramarcha estrutural) sob o degrau
      R.drawMesh(R.GEO.box,[0,y-0.16,z-0.10],[0,0,0],[2.05,0.30,0.42],null,
        {matte:true,col:[0.055,0.054,0.052],rough:0.92,alpha:al});
      R.drawMesh(R.GEO.slab,[0,y,z],[0,0,0],[2.2,0.075,0.46],st,{alpha:al});
      R.drawMesh(R.GEO.slab,[0,y-0.16,z-0.235],[0,0,0],[2.2,0.29,0.05],st,{alpha:al*0.92});
    }
    R.drawMesh(R.GEO.box,[-1.16,-0.55,0.0],[0,0,0],[0.12,1.9,2.6],null,
      {matte:true,col:[0.085,0.083,0.079],rough:0.9,alpha:al});
  }
}

/* ---------- enquadramento responsivo ---------- */
function fitDist(hw,hh,fov,margin){
  const asp=GLOK?R.asp:1.6, t=Math.tan(fov*Math.PI/360);
  return Math.max(hh/t, hw/(t*Math.max(asp,0.2)))*(margin||1.2);
}
const PORT = ()=> (GLOK?R.asp:1.6) < 0.95;
const heroScale = ()=> PORT()? [1.88,2.55,0.13] : [3.05,1.92,0.135];
const matScale  = ()=> PORT()? [0.80,1.14,0.10] : [0.96,1.36,0.105];
const matSpread = ()=> PORT()? 0.94 : 1.32;


/* STUDIO_CONTROLLER */
const stage=canvas.parentElement;
const view=document.getElementById('estudio');
const status=document.getElementById('studio-status');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const sceneNames=['Chapa','Bancada','Ilha','Lavabo','Escada','Corte'];
let scene=0, preset='hero', finish=0, yaw=.35, pitch=.15, zoom=1, cut=.45;
let active=false, raf=0, moving=false, time=0, last=0, dragging=null, failed=false;
const motion=document.getElementById('studio-motion');
function announce(){status.textContent=sceneNames[scene]+' · '+document.getElementById('studio-stone').selectedOptions[0].text+' · '+['Polido','Acetinado','Escovado'][finish];}
function requestRender(){if(active&&!document.hidden&&!failed&&!raf)raf=requestAnimationFrame(render);}
function render(now){
 raf=0;if(!active||document.hidden||failed)return;
 try{
 const dt=last?Math.min((now-last)/1000,.05):0;last=now;
 if(moving&&!reduced.matches){time+=dt;yaw=Math.sin(time*.25)*.7;}
 R.beginFrame();
 const st=withFinish(stoneFor(preset),finish);
 const slab=scene===0||scene===5;
 const dist=(slab?fitDist(heroScale()[0]/2,heroScale()[1]/2,40,1.3):fitDist(2.3,1.55,43,1.32))/zoom;
 const center=slab?[0,0,0]:[0,-.35,-.5];
 const angle=clamp(yaw,-1.35,1.35), elevation=clamp(pitch,-.15,1.05);
 R.setCamera([Math.sin(angle)*dist,center[1]+(.2+elevation)*dist*.65,Math.cos(angle)*dist+center[2]],center,slab?40:43);
 R.drawBG({t:time,top:[.32,.31,.29],bot:[.16,.145,.12],glow:[.70,.65,.55],gx:.4,gy:.65,gr:.5});
 if(scene===5){
  const sc=heroScale(),x=lerp(sc[0]*.49,-sc[0]*.49,cut),sep=smooth(clamp((cut-.8)/.2,0,1));
  R.drawMesh(R.GEO.slabHi,[0,0,0],[0,0,0],sc,st,{clip:{n:[-1,0,0],d:-x},doubleSided:true});
  R.drawMesh(R.GEO.slabHi,[0,-sep*.3,sep*.3],[0,0,-sep*.06],sc,st,{clip:{n:[1,0,0],d:x},doubleSided:true});
  if(cut>.01&&cut<.99){
   R.drawMesh(R.GEO.box,[x,0,.135],[0,0,0],[.025,sc[1]*1.1,.025],null,{matte:true,col:[.1,.08,.04],emis:[1.5,1.1,.5],doubleSided:true});
   R.drawPoints(R.PT_CUT,{t:time,size:2.2,mode:1,origin:[x,0,.12],prog:cut,col:[1,.88,.66],alpha:.6});
  }
 }else if(scene===0){
  R.drawMesh(R.GEO.slabHi,[0,0,0],[-.06,0,0],heroScale(),st,{glow:.03});
 }else drawStage(scene,1,st,0);
 R.endFrame({t:time,bloom:.15,vig:.09,grain:.004,ca:0,fade:1,thr:.94});
 view.dataset.frame=String((Number(view.dataset.frame)||0)+1);
 if(moving&&!reduced.matches)requestRender();
 }catch(error){failed=true;document.dispatchEvent(new Event('studio-unavailable'));}
}
function setActive(value){active=value;last=0;if(active){announce();requestRender();}else{cancelAnimationFrame(raf);raf=0;}}
function reset(){yaw=.35;pitch=.15;zoom=1;document.getElementById('studio-zoom').value=100;requestRender();}
document.querySelectorAll('[data-scene]').forEach(button=>button.addEventListener('click',()=>{
 scene=Number(button.dataset.scene);
 document.querySelectorAll('[data-scene]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 document.getElementById('studio-cut-control').hidden=scene!==5;
 reset();announce();
}));
document.querySelectorAll('[data-finish]').forEach(button=>button.addEventListener('click',()=>{
 finish=Number(button.dataset.finish);
 document.querySelectorAll('[data-finish]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 announce();requestRender();
}));
document.getElementById('studio-stone').addEventListener('change',e=>{preset=e.target.value;announce();requestRender();});
document.getElementById('studio-zoom').addEventListener('input',e=>{zoom=Number(e.target.value)/100;requestRender();});
document.getElementById('studio-cut').addEventListener('input',e=>{cut=Number(e.target.value)/100;requestRender();});
document.getElementById('studio-reset').addEventListener('click',reset);
function updateMotion(){motion.setAttribute('aria-pressed',String(moving));motion.textContent=moving?'Pausar movimento':'Ativar movimento';}
motion.addEventListener('click',()=>{moving=!moving;updateMotion();requestRender();});
reduced.addEventListener('change',()=>{if(reduced.matches){moving=false;updateMotion();}requestRender();});
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;dragging={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!dragging)return;yaw=clamp(yaw+(e.clientX-dragging.x)*.008,-1.35,1.35);pitch=clamp(pitch+(e.clientY-dragging.y)*.006,-.15,1.05);dragging={x:e.clientX,y:e.clientY};requestRender();});
canvas.addEventListener('pointerup',()=>dragging=null);canvas.addEventListener('pointercancel',()=>dragging=null);canvas.addEventListener('lostpointercapture',()=>dragging=null);
canvas.addEventListener('keydown',e=>{
 if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','=','Home'].includes(e.key))return;
 e.preventDefault();
 if(e.key==='Home')reset();
 if(e.key==='ArrowLeft')yaw-=.12;if(e.key==='ArrowRight')yaw+=.12;
 if(e.key==='ArrowUp')pitch+=.1;if(e.key==='ArrowDown')pitch-=.1;
 if(e.key==='+'||e.key==='=')zoom+=.1;if(e.key==='-')zoom-=.1;
 yaw=clamp(yaw,-1.35,1.35);pitch=clamp(pitch,-.15,1.05);zoom=clamp(zoom,.7,1.6);
 document.getElementById('studio-zoom').value=Math.round(zoom*100);requestRender();
});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();failed=true;cancelAnimationFrame(raf);raf=0;document.dispatchEvent(new Event('studio-unavailable'));});
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else{last=0;requestRender();}});
new ResizeObserver(requestRender).observe(stage);
announce();updateMotion();
return {setActive};
};
