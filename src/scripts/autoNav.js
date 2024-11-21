// JavaScript source code
// Make reusable navigation bar
let pgSets = {
    mainPages : {
        Home: { name: 'Home', href: '/' },
        Cv: { name: 'CV', href: '/cv/cv-2024-technion-graduate.html' },
        Passion_1: { name: 'Languages', href: 'https://ahrontv.github.io/hablemos-oso/' }, // if I put /hablemos-oso
        Passion_2: { name: 'My Cat', href: '/cat/my-cat.html' },
        Passion_3: { name: 'Digital Stickers', href: '/stickers/digital-stickers.html' },
    }
};

function markCurrPg(pg, currPg,listItem) {
    if (pg.includes(currPg)) listItem.classList.add('currPg');
}
function createNav(setPages) {
    let nav = document.createElement('nav');
    const list = document.createElement('ul');
    let currPg = window.location.pathname.split('/').pop() || 'home.html';
    Object.entries(setPages).forEach(([key, value]) => {
        let newA = document.createElement('a');
        newA.textContent = value.name;
        newA.href = value.href;
        let newLi = document.createElement('li');
        newLi.appendChild(newA);
        markCurrPg(newA.href, currPg, newLi);
        list.appendChild(newLi);
    })
    nav.appendChild(list)
    return nav
}
function addNav(pgs) {
    try {
        // Is there a header already? If not make one and add to it
        const header = document.querySelector('header') || document.createElement('header');
        if (header.parentNode === null) document.body.prepend(header);
        if (!pgs) pgs = pgSets.mainPages
        const nav = createNav(pgs);
        header.prepend(nav);
    }
    catch (err) {
        console.error('Error in addNav:', err);
    }

}