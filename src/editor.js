import { toHast as mdast2hast, defaultHandlers } from 'mdast-util-to-hast';
import { raw } from 'hast-util-raw';
import { mdast2hastGridTablesHandler, TYPE_TABLE } from '@adobe/mdast-util-gridtables';
import { toHtml } from 'hast-util-to-html';
import parseMarkdown from './libs/parseMarkdown.bundle.js';
import objectHash from 'object-hash';
import { v4 as uuidv4 } from 'uuid';
import Sortable from 'sortablejs';

async function getMdastFromMd(mdContent) {
  const state = { content: { data: mdContent }, log: '' };
  await parseMarkdown(state);
  return state.content.mdast;
}

async function getMd(path) {
  const mdPath = `${path}.md`;
  const mdFile = await fetch(mdPath);
  return mdFile.text();
}
  
async function getMdast(path) {
  const mdContent = await getMd(path);
  return getMdastFromMd(mdContent);
}

const hashToContentMap = new Map();

function processMdast(nodes) {
  const arrayWithContentHash = [];
  nodes.forEach((node) => {
    const hash = objectHash.sha1(node);
    arrayWithContentHash.push(hash);
    hashToContentMap.set(hash, node);
  });
  return arrayWithContentHash;
}

function getProcessedMdast(mdast) {
  const nodes = mdast.children || [];
  return processMdast(nodes);
}

let hashArray = [];

function getMergedMdast(langstoreNowProcessedMdast, livecopyProcessedMdast) {
  const mergedMdast = { type: 'root', children: [] };

  function addTrackChangesInfo(author, action, root) {
    root.author = author;
    root.action = action;

    function addTrackChangesInfoToChildren(content) {
      if (content?.children) {
        const { children } = content;
        for (let i = 0; i < children.length; i += 1) {
          const child = children[i];
          if (child.type === 'text' || child.type === 'gtRow' || child.type === 'image') {
            child.author = author;
            child.action = action;
          }
          if (child.type !== 'text') {
            addTrackChangesInfoToChildren(child);
          }
        }
      }
    }
    addTrackChangesInfoToChildren(root);
  }

  // Iterate and insert content in mergedMdast as long as both arrays have content
  const length = Math.min(langstoreNowProcessedMdast.length, livecopyProcessedMdast.length);
  let index;
  for (index = 0; index < length; index += 1) {
    if (langstoreNowProcessedMdast[index] === livecopyProcessedMdast[index]) {
      const content = hashToContentMap.get(langstoreNowProcessedMdast[index]);
      mergedMdast.children.push(content);
      hashArray.push({hash: langstoreNowProcessedMdast[index]});
    } else {
      const langstoreContent = hashToContentMap.get(langstoreNowProcessedMdast[index]);
      // addTrackChangesInfo('Langstore Version', 'deleted', langstoreContent);
      mergedMdast.children.push(langstoreContent);
      hashArray.push({hash:langstoreNowProcessedMdast[index], type:'deleted', desc: 'Langstore Version'});
      const livecopyContent = hashToContentMap.get(livecopyProcessedMdast[index]);
      // addTrackChangesInfo('Regional Version', 'added', livecopyContent);
      mergedMdast.children.push(livecopyContent);
      hashArray.push({hash:livecopyProcessedMdast[index], type: 'added', desc: 'Regional Version'});
    }
  }

  // Insert the leftover content in langstore if any
  if (index < langstoreNowProcessedMdast.length) {
    for (; index < langstoreNowProcessedMdast.length; index += 1) {
      const langstoreContent = hashToContentMap.get(langstoreNowProcessedMdast[index]);
      // addTrackChangesInfo('Langstore Version', 'deleted', langstoreContent);
      mergedMdast.children.push(langstoreContent);
      hashArray.push({hash:langstoreNowProcessedMdast[index], type:'deleted', desc: 'Langstore Version'});
    }
  }

  // Insert the leftover content in livecopy if any
  if (index < livecopyProcessedMdast.length) {
    for (; index < livecopyProcessedMdast.length; index += 1) {
      const livecopyContent = hashToContentMap.get(livecopyProcessedMdast[index]);
      mergedMdast.children.push(livecopyContent);
      hashArray.push({hash:livecopyProcessedMdast[index]});
    }
  }

  return mergedMdast;
}

async function md2html(path1, path2) {
  const mdast1 = await getMdast(path1);
  const processedMdast1 = getProcessedMdast(mdast1);

  const mdast2 = await getMdast(path2);
  const processedMdast2 = getProcessedMdast(mdast2);

  const mdast = getMergedMdast(processedMdast1, processedMdast2);



  const hast = mdast2hast(mdast, {
    handlers: {
      ...defaultHandlers,
      [TYPE_TABLE]: mdast2hastGridTablesHandler(),
    },
    allowDangerousHtml: true,
  });

  raw(hast);
  //rehypeFormat()(hast);
  // removePosition(hast, true);

  hast.children = hast.children.filter(child => !(child.type === 'text' && child.value === '\n') )
    .map(function(child) {
      return {
        child,
        uuid: uuidv4(),
      };
    });
  return hast;
  // console.log(hast);
  // console.log(mdast);
  // console.log(hashArray);

  // const data = toHtml(hast, {
  //   upperDoctype: true,
  // });
  // return data;
}

function wrap(el, wrapper) {
  el.parentNode.insertBefore(wrapper, el);
  wrapper.appendChild(el);
}

function createTool() {
  const toolbox = document.createElement('div');
  toolbox.classList.add('toolbox');

  // Create the cross icon div
  const crossIcon = document.createElement('div');
  crossIcon.classList.add('icon', 'cross-icon');
  crossIcon.textContent = '✖'; // Unicode character for a cross

  // Create the right icon div
  const rightIcon = document.createElement('div');
  rightIcon.classList.add('icon', 'right-icon');
  rightIcon.textContent = '✔'; // Unicode character for a checkmark

  toolbox.appendChild(crossIcon);
  toolbox.appendChild(rightIcon);
  return toolbox;
}

const init = async () => {
  const hast = await md2html("files/langstore", "files/region");
  console.log(hast);
  const fragment = new DocumentFragment();
  hast.children?.forEach((child, i) => {
    const elem = toHtml(child.child, {
      upperDoctype: true,
    });
    const w = document.createElement('div');
    w.insertAdjacentHTML('beforeend', elem);
    w.appendChild(createTool());
    w.setAttribute('id', child.uuid);
    w.classList.add('elem-wrap');
    if(hashArray[i].type === 'deleted') {
      w.classList.add('deleted');
    } else if(hashArray[i].type === 'added') {
      w.classList.add('added');
    } else {
      w.classList.add('orig');
    }
    fragment.append(w);
  });
  document.querySelector('#app').append(fragment);
  Sortable.create(app, {
    group: 'app',
    animation: 100
  });

  document.querySelector('#collapse').addEventListener('click', function() {
    document.querySelector('#app').classList.toggle('collpased');
  }, false);

  let currentScale = 1;
  document.querySelector('#scale-down').addEventListener('click', function() {
    currentScale = currentScale-currentScale/10;
    document.querySelector('#app').style.transform = `scale(${currentScale})`;
  }, false);
  document.querySelector('#scale-up').addEventListener('click', function() {
    currentScale = currentScale+currentScale/10;
    document.querySelector('#app').style.transform = `scale(${currentScale})`;
  }, false);
};

export default init;
