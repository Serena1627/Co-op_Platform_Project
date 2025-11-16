let form = document.getElementById('sign-up-form');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let firstName = document.getElementById('firstName').value;
    let lastName = document.getElementById('lastName').value;
    let emailAddress = document.getElementById('email').value;
    let password = document.getElementById('password').value;
    let accountType = document.querySelector('input[name="accountType"]:checked').value;

    try {
        let response = await fetch('http://localhost:3000/sign-in', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json'},
            body: JSON.stringify({firstName, lastName, emailAddress, password, accountType})});
    
        let data = await response.json();

        if (response.ok) {
        form.reset();
        }
    } catch (error){
        alert("Error connecting to server: " + error.message);
    }

});