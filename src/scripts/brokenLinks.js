// JavaScript source code
document.addEventListener('click', function (event) {
    if (event.target.tagName === 'A') {
        event.preventDefault();
        const link = event.target.getAttribute('href');
        const target = event.target.getAttribute('target')|| '_self';
        fetch(link, { method: 'HEAD' }).then(response => {

            if (
                response.ok) {
                    // window.location.href = link;
                    window.open(link,target);
            } else {
                console.log(`issue with link ${link}`);
                window.open('/src/templates/page-under-development.html', '_blank');
            }
        }).catch(() => {
            window.open('/src/templates/page-under-development.html', '_blank');
            console.log(`issue with link ${link}`);
        });
    }
});