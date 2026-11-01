# Examples index

Every gallery demo of the DataFlow Animator site, as a spec that renders and
validates. Open `<id>.json` in this folder. Pick the one or two closest to the
request by layout first, then by the actions they use.

## `left-to-right`

| id | title | what it shows | actions | node types | features |
| --- | --- | --- | --- | --- | --- |
| `clientServer` | Client-Server | Client-server architecture | comment, loading, move, parallel, set_content, wait | database, laptop, server | packets: http_packet, sql_request, sql_response; connections |
| `microservices` | Microservices behind an Nginx proxy | Auth and Data behind Nginx, each with its database: authentication (JWT) then data request. | comment, loading, move | database, laptop, server | packets: http_packet, sql_request, sql_response; connections |
| `spa` | SPA loading then API calls | The web server returns HTML then JavaScript; the rendered shell waits for the data, which the Web API serves as JSON. | comment, loading, move, parallel, set_content, wait | database, laptop, server | packets: http_packet, sql_request, sql_response; connections |
| `crypto` | Cryptography: Alice, Bob & Eve | Diffie-Hellman key exchange on a public channel eavesdropped by Eve: she sees the public values pass by but cannot reconstruct the shared key. | comment, highlight, move, parallel, set_content | alice, bob, eve | packets: http_packet; connections |
| `tls` | TLS 1.3 handshake | ClientHello / ServerHello, certificate validation, session key derivation, then switch to encrypted channel for application data. | arrow, comment, loading, move | laptop, server | packets: http_packet; connections |
| `oauth` | OAuth 2.0 — Authorization Code | Delegated login: redirection to the authorization server, single-use code, exchange for a token on the back channel, then API call. | comment, loading, move | server, user | packets: http_packet; connections |
| `dos` | Denial-of-service attack (DoS) | A single machine floods the server with requests until it saturates; the legitimate user is then denied service. Since everything comes from one IP, the attack stays blockable. | comment, loading, move, parallel, set_content | eve, server, user | packets: http_packet; connections |
| `ddos` | Distributed denial-of-service attack (DDoS) | A command-and-control server (C&C) orders a botnet to attack: every bot floods the target simultaneously. With traffic coming from thousands of IPs, you cannot just block one address. | comment, loading, move, parallel, set_content | desktop, eve, server, user | packets: http_packet; connections |
| `rateLimit` | DoS countermeasure: rate limiting | A reverse proxy caps requests per IP: the single-source flood is rejected with 429 at the edge, the backend stays healthy and the legitimate user keeps being served. | comment, loading, move, parallel, set_content | eve, server, user | packets: http_packet; connections |
| `scrubbing` | DDoS countermeasure: scrubbing center | All traffic flows through a filtering edge (Cloudflare/Anycast-style) that absorbs the volumetric flood and drops the bots; only the legitimate request reaches the origin, which never sees the attack. | comment, loading, move, parallel, set_content | cloud, desktop, server, user | packets: http_packet; connections |
| `dns` | Recursive DNS resolution | The resolver queries the root, the TLD and then the authoritative server in turn before returning the IP address to the browser (and caching it). | comment, loading, move | laptop, server | packets: http_packet |
| `cicd` | CI/CD pipeline | From git push to deployment: webhook, tests and build in the runner, publishing the image to the registry, then deploying to production. | comment, loading, move, set_content | cloud, database, laptop, server | packets: http_packet; connections; zones |
| `messageQueue` | Message queue (publish/subscribe) | A producer publishes an event in a broker, which distributes it to multiple workers; each processes then acknowledges. | comment, loading, move, parallel, set_content | server | packets: http_packet; connections |
| `cdn` | CDN cache — MISS then HIT | The same resource requested twice: first call is a cache MISS (goes to origin), second is a cache HIT served immediately from the edge. | comment, loading, move, set_content, wait | server, user | packets: http_packet; connections |
| `loadBalancer` | Load balancer (round-robin) | Three successive requests distributed to different backends; the fourth loops back to the first. | comment, loading, move | server, users | packets: http_packet; connections |
| `kubernetes` | Kubernetes deployment | From kubectl apply to Running pod: the API Server persists the desired state in etcd, the scheduler picks a node, the kubelet starts the container. | comment, loading, move, set_content | database, laptop, server | packets: http_packet; connections; zones |
| `payment` | Online payment (3-D Secure) | Payment intent, bank authorization with strong authentication, then asynchronous shop confirmation via webhook. | comment, loading, move | cloud, mobile, server | packets: http_packet; connections |
| `blockchain` | Blockchain transaction | A signed transaction joins the mempool, multiple miners search for the nonce, one forges the block and propagates it to the network. | comment, loading, move, parallel, set_content | database, desktop, mobile, server | packets: http_packet; connections |
| `smtp` | Email routing | From Alice's client to Bob's inbox: SMTP dispatch, MX record resolution, relay between mail servers, then IMAP retrieval. | comment, loading, move, set_content | laptop, mobile, server | packets: http_packet; connections |
| `graphql` | Federated GraphQL gateway | A single request split by the gateway to multiple subgraphs, whose responses are recomposed into a single object. | comment, loading, move, parallel | laptop, server | packets: http_packet; connections |
| `webhook` | Webhook with retries (back-off) | Delivery fails twice (receiver unavailable) then succeeds; the dead times between attempts materialize the exponential back-off. | comment, loading, move, set_content | cloud, server | packets: http_packet; connections |
| `collision` | Anti-collision (parallel lanes) | The App ↔ DB segment is used in both directions simultaneously: the engine automatically offsets the paths into parallel lanes. | arrow, comment, move, parallel, wait | database, server | packets: sql_request, sql_response; connections |
| `pushNotifications` | Push notifications (FCM) | Full lifecycle of a push notification: how Alice's device registers its delivery address (the FCM token), then how a message sent by Bob is routed to her, even if her app is closed. | comment, loading, move | alice, bob, cloud, database, server | packets: http_packet, sql_request, sql_response; connections; zones |

## `circular`

| id | title | what it shows | actions | node types | features |
| --- | --- | --- | --- | --- | --- |
| `signalr` | Full-duplex real-time (SignalR) | Persistent WebSocket connection: we see the client code and the hub code, then a SendAll broadcasting the message to all connected clients. | arrow, comment, move, parallel, set_content, set_visible | laptop, server | packets: http_packet; hidden nodes |
| `raft` | Raft consensus — leader election | Circular layout: a candidate requests votes from followers, gets the majority, becomes leader then maintains authority via heartbeats. | comment, move, parallel, set_content | server | packets: http_packet |
| `circular` | Circular orchestration | Circular layout: a central orchestrator distributes a command to satellite services then aggregates their confirmations. | comment, move, parallel, set_content | server | packets: http_packet |

## `tree`

| id | title | what it shows | actions | node types | features |
| --- | --- | --- | --- | --- | --- |
| `redBlackTree` | Red-black tree — recoloring | Inserting a red leaf under a red parent whose uncle is also red: rebalancing is a pure recoloring (parent and uncle to black, grandparent to red), no rotation. Showcases the set_color action. | comment, highlight, move, parallel, set_color, set_visible | circle | packets: subicon; tree; hidden nodes |
| `redBlackRotation` | Red-black tree — rotation | The rotation case: inserting a red node under a red parent whose uncle is black. Recoloring alone is not enough — it takes a rotation then a recoloring. Combines the rotate_subtree and set_color actions. | comment, highlight, move, parallel, rotate_subtree, set_color, set_visible | circle | packets: subicon; tree; hidden nodes |
| `avlTree` | AVL tree — rotation | Inserting 10, 20, 30 degenerates into a right-leaning chain (balance factor −2). A single left rotation rebalances it. Showcases direction:'tree' and the rotate_subtree action (nodes glide to their new depth). | comment, highlight, move, parallel, rotate_subtree, set_visible | circle | packets: subicon; tree; hidden nodes |
| `bstSearch` | Binary tree — search | Searching a key in a binary search tree: a token descends from the root, compares at each node and branches left or right until it finds the value. Shows the step-by-step O(log n) descent. | comment, highlight, move, parallel, set_color, wait | circle | packets: subicon; tree |
| `bstInsert` | Binary tree — insertion | Inserting a key into a binary search tree: the new key arrives as an orphan and walks down step by step, comparing at each node, until the empty slot where the node is then created. | comment, move, parallel, set_visible | circle | packets: subicon; tree; hidden nodes |

## `graph`

| id | title | what it shows | actions | node types | features |
| --- | --- | --- | --- | --- | --- |
| `dijkstra` | Shortest path — Dijkstra | Dijkstra's algorithm on a free weighted graph (direction:'graph', nodes placed via x/y). It settles the nearest unvisited node in turn; each step recolours the node and the edge it was reached through, growing the shortest-path tree to the target. | comment, parallel, set_color, set_icon, wait | circle | connections |
| `astar` | Shortest path — A* | A* on a grid (direction:'graph', nodes placed via x/y): Dijkstra guided by a heuristic h(n) = Manhattan distance still to go. It always expands the node with the smallest f = g + h, so the search heads straight for the goal without exploring the sideways cells. | comment, parallel, set_color, set_icon, wait | circle | connections; x/y pinned |
| `mst` | Minimum spanning tree — Kruskal | Kruskal's algorithm (direction:'graph'): sort the edges by weight and add the cheapest one that does not form a cycle, until all six nodes are linked by five edges. Accepted edges turn green; those that would close a cycle are skipped. | comment, highlight, parallel, set_color | circle | connections |

## `circuit`

| id | title | what it shows | actions | node types | features |
| --- | --- | --- | --- | --- | --- |
| `circuit` | Electrical circuit (current) | A battery/switch/resistor/LED series loop on `direction: circuit`: orthogonal wires between named terminals, closing the switch (`toggle`), then animated current (`flow`) and the LED lighting up. | comment, flow, highlight, parallel, toggle, wait | battery, led, resistor, switch | connections |
| `circuitParallel` | Parallel circuit (two LEDs) | Two LEDs in parallel on `direction: circuit`: the current (`flow`) splits at the junction, feeds both branches at once, then recombines. | comment, flow, highlight, parallel, wait | battery, junction, led, resistor | connections; x/y pinned |
| `ohmsLaw` | Ohm’s law (voltage, current, power) | Explains the difference between voltage (potential difference, across), current (amperage, through), resistance and power (V·I) on a series circuit with an ammeter and a voltmeter. | comment, flow, highlight, parallel, set_icon, wait | ammeter, battery, junction, resistor, voltmeter | connections; x/y pinned |
| `logicGates` | Logic gates | The six core logic gates (AND, OR, XOR, NAND, NOR, NOT), fed the same inputs, with each one’s rule and output. | comment, parallel, set_color, set_icon, wait | and_gate, buffer_gate, nand_gate, nor_gate, not_gate, or_gate, signal, xnor_gate, xor_gate | connections |
| `halfAdder` | Half-adder (wired gates) | A complete digital diagram: two bits A and B added by a XOR (sum) and an AND (carry), stepping through all four combinations. | comment, parallel, set_color, set_icon, wait | and_gate, signal, xor_gate | connections; diagonal_wires |
| `halfAdderNand` | Half-adder (NAND gates) | The half-adder rebuilt from NAND gates alone (the "universal" gate): five NANDs reproduce the XOR (sum) and AND (carry). | comment, parallel, set_color, set_icon, wait | nand_gate, signal | connections |
| `halfSubtractorNand` | Half-subtractor (NAND gates) | The half-subtractor (A − B) from NAND gates alone: five gates give the difference (XOR) and the borrow (A′·B), mirroring the half-adder. | comment, parallel, set_color, set_icon, wait | nand_gate, signal | connections |
| `fullAdderNand` | Full adder (NAND gates) | The full adder (A + B + carry) from nine NAND gates: two XORs for the sum, the carry reusing their inner terms. The cell of every adder. | comment, parallel, set_color, set_icon, wait | nand_gate, signal | connections |
| `fullSubtractorNand` | Full subtractor (NAND gates) | The full subtractor (A − B − borrow) from eleven NAND gates: a double XOR for the difference, the borrow reusing the XOR’s inner terms. | comment, parallel, set_color, set_icon, wait | nand_gate, signal | connections |
| `srLatch` | SR latch (NAND gates) | Two cross-coupled NAND gates form a latch — one bit of memory. Active-low inputs stepping through set, reset and hold (the memory). | comment, parallel, set_color, set_icon, wait | nand_gate, signal | connections; diagonal_wires; x/y pinned |
| `cmosNand` | CMOS NAND gate (4 transistors) | What is INSIDE a NAND gate: two pMOS in parallel above, two nMOS in series below. The conducting transistors light up for each input combination. | comment, parallel, set_color, set_icon, wait | ground, junction, mosfet_n, mosfet_p, signal | connections; x/y pinned |
| `mux4to1` | Multiplexer 4:1 (generic block) | Four inputs, two select bits, one output — a block whose terminals are declared in the spec rather than one symbol per size. | comment, parallel, set_color, set_icon, wait | block, signal | connections; x/y pinned |
| `rcCircuit` | RC circuit (charging) | A resistor charges a capacitor: the transient response, the time constant τ = R·C, the exponential voltage rise, and the current stopping once charged. | comment, flow, highlight, parallel, set_color, set_icon, toggle, wait | battery, capacitor, resistor, switch | connections |
