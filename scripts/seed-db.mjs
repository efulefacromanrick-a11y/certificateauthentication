const response = await fetch(`http://localhost:${process.env.PORT || 4000}/seed`, {
  headers: {
    Authorization: `Bearer ${process.env.SEED_TOKEN || ''}`,
  },
});

const body = await response.text();
if (!response.ok) {
  throw new Error(`Database seed failed (${response.status}): ${body}`);
}

console.log(body);
