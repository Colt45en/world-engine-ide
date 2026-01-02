import asyncio
from brain.relay.ws_server import RelayServer

if __name__ == '__main__':
    server = RelayServer()
    print('Starting RelayServer on ws://localhost:9000')
    asyncio.run(server.start())
