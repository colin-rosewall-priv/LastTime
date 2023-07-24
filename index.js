console.log("last time app starting");

const db = new Dexie("myLastTimeDatabase");
db.version(1).stores({
    events: 'event',
    eventOccurrences: '++id,[description+occurred]'
});

db.version(2).stores({
    eventOccurrences: '++id,&[description+occurred]'
});

db.open().then(function (db) {
    console.log("Database " + db.name + " opened successfully");
}).catch (function (err) {
    console.error(err.stack || err);
});

var dataSet = [
    ['', '', ''],
];

function monthNumberFormatted(month) {
    return ( month < 10 ? `0${month}` : `${month}`);
}

function dayNumberFormatted(day) {
    return (day < 10 ? `0${day}` : `${day}`);
}

function formatDateYYYYMMDD(theDate) {
    let year = theDate.getFullYear();
    let month = monthNumberFormatted(theDate.getMonth() + 1);
    let day = dayNumberFormatted(theDate.getDate());

    let formattedDate = `${year}-${month}-${day}`;
    // console.log(formattedDate);

    return(formattedDate);
}

function setupFirstScreen() {
    let today = new Date();
    let year = today.getFullYear();
    let month = monthNumberFormatted(today.getMonth() + 1);
    let day = dayNumberFormatted(today.getDate());

    let todayFormatted = formatDateYYYYMMDD(today);
    // console.log(`todayFormatted = ${todayFormatted}`);

    document.getElementById("addform_description").value = "";
    document.getElementById("addform_occurrencedate").value = todayFormatted;
    
    populateDescriptionList();
    populateOccurrences();
}

function addOccurrence(theDescription, theDate) {
    console.log("addOccurrence");

    db.transaction('rw', db.events, db.eventOccurrences, async function() {
        const keyValue = await db.events.get(theDescription);
        if (typeof keyValue === "undefined") {
            db.events.add({event: theDescription});
            console.log("event has been added");
        };
        db.eventOccurrences.add({description: theDescription, occurred: theDate});    
    })
    .catch(function (err) {
        console.error(err.stack || err);
    });
}

function populateDescriptionList() {
    console.log("populateDescriptionList");

    db.transaction('r', db.events, function() {
        return db.events.toArray();
    })
    .then((events) => {
        const eventList = events.map(obj => `<option>${obj.event}</option>`);
        const allJoined = eventList.join('');
        document.getElementById("description_list").innerHTML = allJoined;
    })
    .catch(function (err) {
        console.error(err.stack || err);
    });
}

function populateOccurrences() {
    console.log("populateOccurrences");
    let today = formatDateYYYYMMDD(new Date());

    let twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    twoYearsAgo = formatDateYYYYMMDD(twoYearsAgo);

    //console.log('twoYearsAgo = ' + twoYearsAgo);

    const objects = new Object();
    let propertyAdded = false;

    db.transaction('r', db.eventOccurrences, function() {
        return db.eventOccurrences.where('[description+occurred]').between(
            [Dexie.minKey, twoYearsAgo],
            [Dexie.maxKey, today]
        ).toArray();
    }).then((events) => {
        events.forEach(item => {
            const exists = objects.hasOwnProperty(item.description);
            if (exists) {
                const currentValue = objects[item.description];
                if (item.occurred > currentValue.theDate) {
                    objects[item.description].theDate = item.occurred;
                };
            } else {
                objects[item.description] = {theDate: item.occurred, theDays: 0};
                propertyAdded = true;
            };
        });

    })
    .catch(function (err) {
        console.error(err.stack || err);
    })
    .finally(() => {
        if (propertyAdded) {
            const results = [];
            const today = new Date();

            Object.entries(objects).forEach(([key, value]) => {
                const itemDate = new Date(value.theDate);
                const millisecondsDiff = itemDate.getTime() - today.getTime();
                const daysDiff = Math.ceil(millisecondsDiff / (1000 * 3600 * 24));
                results.push([key, value.theDate, daysDiff]);
            });
            console.log(results);
            dataSet = results;
            $('#summary').DataTable().clear().rows.add(dataSet).draw();    
        }
    });
}

function deleteOccurrences(theDescription) {
    var response = confirm(`Are you sure you want to delete ${theDescription}?`);
    if (response) {
        db.transaction('rw', db.eventOccurrences, async function() {
            var results = await db.eventOccurrences.where({description: theDescription}).delete();
            populateOccurrences();
        })
        .catch(function (err) {
            console.error(err.stack || err);
        });
    }
}

$(document).ready(function () {
    setupFirstScreen();

     var tb = $('#summary').DataTable({
        responsive: true,
        data: dataSet,
        columns: [
            { title: 'Event' },
            { title: 'Last Time' },
            { title: 'Days' },
            { defaultContent: '<button>delete</button>' },
        ],
    });

    tb.on('click', 'button', function (e) {
        var rowData = tb.row(e.target.closest('tr')).data();

        if (Array.isArray(rowData)) {
            var eventDescription = rowData[0];
            if (typeof eventDescription === 'string') {
                deleteOccurrences(eventDescription);
            }
        };
    });
});

const submitForm = document.getElementById("addform");

submitForm.addEventListener("submit", (e) => {
    e.preventDefault();
    
    let theDescription = document.getElementById("addform_description").value.trim();
    if (theDescription.length < 1) {
        e.preventDefault();
        alert("description cannot be blank.");
    }
    else {
        let theDate = document.getElementById("addform_occurrencedate").value;

        addOccurrence(theDescription, theDate);
        setupFirstScreen();
    }

});

const resetButton = document.getElementById("resetform");

resetButton.addEventListener("click", (e) => {
    console.log("addform_reset");
    setupFirstScreen();
});

const clearButton = document.getElementById("addform_clearselection");

clearButton.addEventListener("click", (e) => {
    document.getElementById("addform_description").value = "";
});


